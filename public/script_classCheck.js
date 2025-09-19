//로그아웃 처리: localStorage에서 사용자 정보를 제거하고 로그인 페이지로 이동동
function logout() {
  localStorage.removeItem("username");
    localStorage.removeItem("studentId");
    alert('로그아웃 되었습니다.');
    window.location.href = "/login";
}

const username = localStorage.getItem("username"); 
    const studentId = localStorage.getItem("studentId");

    if (username && studentId) {
        document.getElementById("professorname").textContent = `${username} 교수님`;
    } else {
        document.getElementById("professorname").textContent = "로그인 정보 없음";
    }

//강의 선택 시 관련 버튼(출석,출석부,성적관리)정보를 표시 
function lectureSelected() {
  const selectBox = document.querySelector('.lecture-select');
  const selectedLecture = selectBox.options[selectBox.selectedIndex].text;

  if (selectBox.value !== "") {
    document.querySelector('.content').innerHTML = `
      <h2>${selectedLecture}</h2>
      <button id="attendanceBtn" class="management-btn" onclick="manageAttendance()">출석 관리</button>
      <button id="rollbookBtn" class="management-btn" onclick="viewRollbook()">출석부</button>
      <button id="gradesBtn" class="management-btn" onclick="manageGrades()">성적 관리</button>
      <div id="details">${selectedLecture}의 상세 정보가 표시됩니다.</div>
    `;
  } else {
    document.querySelector('.content').innerHTML = `
      <h2>환영합니다!</h2>
      <p>강의를 선택하면 이곳에 상세 정보가 표시됩니다.</p>
    `;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const selectBox = document.querySelector('.lecture-select');

  if (selectBox) {
    const userType = localStorage.getItem("userType");
    const professorId = localStorage.getItem("studentId");

    fetch(`/courses?userType=${userType}&professorId=${professorId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // 기존 옵션 초기화
          selectBox.innerHTML = '<option value="">강의를 선택하세요</option>';

          // 강의 목록을 select box에 추가
          data.courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.COURSE_CODE + '-' + course.CLASS_SECTION;  // COURSE_CODE와 SECTION을 조합하여 고유값 설정
            option.textContent = `${course.COURSE_NAME} (${course.CLASS_SECTION})`;  // 과목명과 분반을 함께 표시
            selectBox.appendChild(option);
          });
        } else {
          console.error('강의 목록을 불러오는 중 오류 발생');
        }
      })
      .catch(error => console.error('데이터 요청 실패:', error));
  }
});

//출석관리 서버에서 학생 목록과 기존 출석 상태 받아와서 드롭다운형태로 보여주기
function manageAttendance() {
  const selectBox = document.querySelector('.lecture-select');
  const selectedCourseCode = selectBox.value;
  const professorId = localStorage.getItem("studentId");

  if (!selectedCourseCode || !professorId) {
    document.getElementById('details').innerHTML = '강의를 선택해주세요.';
    return;
  }

  const [courseCode, section] = selectedCourseCode.split('-');

  fetch(`/manage-attendance?courseCode=${courseCode}&section=${section}&professorId=${professorId}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        document.getElementById('details').innerHTML = '학생 정보를 불러오는 중 오류가 발생했습니다.';
        return;
      }

      const { students, schedule, attendanceData = [] } = data;
      currentSchedule = schedule; // 👈 전역 변수에 저장

      document.getElementById('details').innerHTML = `
        <div class="attendance-controls">
          출결 날짜: <input type="date" id="attendance-date" onchange="updatePeriodSelect(${JSON.stringify(schedule).replace(/"/g, '&quot;')})">
          교시: <select id="attendance-period"><option>날짜를 선택하세요</option></select>
          <button onclick="saveAttendance()">출결 저장</button>
          <button onclick="markAllAttendance()">일괄 출결</button>
        </div>
        <table>
          <thead>
            <tr><th>이름</th><th>학번</th><th>학년</th><th>학과</th><th>상태</th></tr>
          </thead>
          <tbody>
            ${students.map(student => {
              const existingStatus = attendanceData.find(a => a.S_ID === student.S_ID)?.status || "";
              return `
                <tr>
                  <td>
                  ${student.NAME}${student.IS_RETAKE ? ' <span style="color:red; font-size:0.8em;">(재)</span>' : ''}
                  </td>
                  <td>${student.S_ID}</td>
                  <td>${student.YEAR_GRADE}</td>
                  <td>${student.DEPARTMENT}</td>
                  <td class="status-cell">
                    <select name="status-${student.S_ID}">
                      <option value="출석" ${existingStatus === "출석" ? "selected" : ""}>출석</option>
                      <option value="결석" ${existingStatus === "결석" ? "selected" : ""}>결석</option>
                      <option value="지각" ${existingStatus === "지각" ? "selected" : ""}>지각</option>
                      <option value="공결" ${existingStatus === "공결" ? "selected" : ""}>공결</option>
                    </select>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    })
    .catch(err => {
      console.error('출석 데이터 로드 실패:', err);
      document.getElementById('details').innerHTML = '학생 정보를 불러오는 중 오류가 발생했습니다.';
    });
    highlightSelectedButton('attendanceBtn');
}


function updatePeriodSelect(schedule) {
  const dateStr = document.getElementById('attendance-date').value;
  const day = new Date(dateStr).getDay(); // 일(0) ~ 토(6)
  const periods = schedule[day];

  const select = document.getElementById('attendance-period');
  select.innerHTML = '';

  if (periods) {
    periods.forEach(p => {
      const option = document.createElement('option');
      option.value = p;
      option.textContent = `${p}교시`;
      select.appendChild(option);
    });
  } else {
    const option = document.createElement('option');
    option.textContent = 'X';
    option.disabled = true;
    select.appendChild(option);
  }
}

//출결 데이터 저장 요정을 POSt /save-attendance로 전송함함
function saveAttendance() {
  const attendanceDateRaw = document.getElementById('attendance-date').value;
  const attendanceDate = new Date(attendanceDateRaw).toISOString().split("T")[0];  // YYYY-MM-DD
  const period = document.getElementById('attendance-period').value;
  const professorId = localStorage.getItem("studentId");

  const courseSelect = document.querySelector('.lecture-select');
  const [courseCode, section] = courseSelect.value.split('-');

  if (!attendanceDate || !period) {
    alert("출결 날짜와 교시를 모두 선택해주세요.");
    return;
  }

  // courseId 가져오기: courseCode + section + professorId를 서버에 넘기기 (필요 시)
  fetch(`/get-course-id?courseCode=${courseCode}&section=${section}&professorId=${professorId}`)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        alert("강의 ID 조회 실패");
        return;
      }

      const courseId = data.courseId;

      // 출석 상태 배열 만들기
      const attendanceUpdates = [];
      document.querySelectorAll(".status-cell select").forEach(select => {
        const studentId = select.name.split('-')[1];
        const status = select.value;

        attendanceUpdates.push({
          studentId,
          courseId,
          professorId,
          attendanceDate,
          period,
          status
        });
      });

      // 한번에 출석 상태 저장 요청 (서버가 복수 데이터 받도록 API 수정 가능하면 좋음)
      // 없으면 forEach 돌면서 fetch 여러 번 보내는 것도 가능

      // 여러 요청 보내기
      const requests = attendanceUpdates.map(update =>
        fetch('/update-attendance-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update)
        })
      );

      return Promise.all(requests);
    })
    .then(() => {
      alert("출결 저장 완료!");
      // 출석부 갱신 함수 있으면 호출 (ex: manageAttendance())
      manageAttendance();
    })
    .catch(err => {
      console.error('출결 저장 실패:', err);
      alert("출결 저장 중 오류 발생");
    });
}

//일괄출결 기능, 만약 첫 번째 교시 출석 상태가 없다면 사용할 수 없다는 경고 출력
function markAllAttendance() {
  const attendanceDateRaw = document.getElementById('attendance-date').value;
  const attendanceDate = new Date(attendanceDateRaw).toISOString().split("T")[0];
  const currentPeriod = document.getElementById('attendance-period').value;
  const professorId = localStorage.getItem("studentId");

  if (!attendanceDate || !currentPeriod) {
    alert("출결 날짜와 교시를 먼저 선택해주세요.");
    return;
  }

  const courseSelect = document.querySelector('.lecture-select');
  const [courseCode, section] = courseSelect.value.split('-');

  fetch(`/get-course-id?courseCode=${courseCode}&section=${section}&professorId=${professorId}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        alert("강의 ID 조회 실패");
        return;
      }

      const courseId = data.courseId;
      const day = new Date(attendanceDateRaw).getDay(); // 0~6
      const periods = currentSchedule[day] || [];

      const remainingPeriods = periods.filter(p => p > currentPeriod);

      // ✅ 1교시 출결 데이터 가져오기
      return fetch(`/get-attendance-status?courseId=${courseId}&date=${attendanceDate}&period=${currentPeriod}`)
        .then(res => res.json())
        .then(attendanceData => {
          if (!attendanceData.success || !attendanceData.statuses || Object.keys(attendanceData.statuses).length === 0) {
            alert("해당 기능을 이용할 수 없습니다.\n첫 번째 교시의 출석 상태를 먼저 입력해주세요.");
            throw new Error("첫 교시 출석 상태 없음");
          }

          // { studentId: "출석" } 형태로 가정
          const baseStatuses = attendanceData.statuses;

          const requests = [];

          for (const period of remainingPeriods) {
            for (const [studentId, status] of Object.entries(baseStatuses)) {
              const update = {
                studentId,
                courseId,
                professorId,
                attendanceDate,
                period,
                status
              };

              requests.push(
                fetch('/update-attendance-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(update)
                })
              );
            }
          }

          return Promise.all(requests);
        });
    })
    .then(() => {
      alert("일괄 출결 저장 완료!");
      manageAttendance(); // 출석부 갱신
    })
    .catch(err => {
      console.error("일괄 출결 실패:", err);
    });
}

//1~15교시 옵션 생성하여 select 박스에 표시할 html 반환환
function generatePeriodOptions() {
  let options = '<option value="">선택</option>';
  for (let i = 1; i <= 15; i++) {
    options += `<option value="${i}">${i}</option>`;
  }
  return options;
}

//강의 추가 폼을 동적으로 생성하여 입력가능하게 함함
function openCourseApplication() {
  document.querySelector('.content').innerHTML = `
    <form id="courseForm" class="course-form" onsubmit="submitCourseApplication(event)">
      <h1>강의 신청</h1>
      <div class="form-group">
        <label for="courseCode">과목 코드:</label>
        <input type="text" id="courseCode" name="courseCode" required>
      </div>
      <div class="form-group">
        <label for="courseName">과목 이름:</label>
        <input type="text" id="courseName" name="courseName" required>
      </div>
      <div class="form-group">
        <label for="campus">캠퍼스:</label>
        <select id="campus" name="campus" required>
          <option value="서산">서산</option>
          <option value="태안">태안</option>
        </select>
      </div>
      <div class="form-group">
        <label for="educationType">교육 계열:</label>
        <select id="educationType" name="educationType" required>
          <option value="">선택하세요</option>
          <option value="전공">전공</option>
          <option value="교양필수">교양필수</option>
          <option value="교양1영역">교양1영역</option>
          <option value="교양2영역">교양2영역</option>
          <option value="교양3영역">교양3영역</option>
          <option value="본교 사이버">본교사이버</option>
        </select>
      </div>
      <div class="form-group">
        <label for="college">학부:</label>
        <input type="text" id="college" name="college" required>
      </div>
      <div class="form-group">
        <label for="department">학과:</label>
        <input type="text" id="department" name="department" required>
      </div>
      <div class="form-group">
        <label for="year">학년:</label>
        <div id="year" name="year[]" class="checkbox-group" required>
          <label><input type="checkbox" name="year[]" value="1"> 1학년</label>
          <label><input type="checkbox" name="year[]" value="2"> 2학년</label>
          <label><input type="checkbox" name="year[]" value="3"> 3학년</label>
          <label><input type="checkbox" name="year[]" value="4"> 4학년</label>
        </div>
      </div>
      <div class="form-group">
        <label for="section">분반:</label>
        <input type="text" id="section" name="section" required>
      </div>
      <div class="form-group">
        <label for="professorID">교수 ID:</label>
        <input type="text" id="professorID" name="professorID" required>
      </div>
      <div class="form-group">
        <label for="maxStudents">제한 인원수:</label>
        <input type="number" id="maxStudents" name="maxStudents" min="1" required>
      </div>
      <div class="form-group">
        <label for="days">강의 시간 (요일):</label>
        <div id="days" name="days[]" class="checkbox-group" required>
          <label><input type="checkbox" name="days[]" value="월"> 월요일</label>
          <label><input type="checkbox" name="days[]" value="화"> 화요일</label>
          <label><input type="checkbox" name="days[]" value="수"> 수요일</label>
          <label><input type="checkbox" name="days[]" value="목"> 목요일</label>
          <label><input type="checkbox" name="days[]" value="금"> 금요일</label>
        </div>
      </div>
      <div class="form-group">
        <div id="timeFields">
          ${['월', '화', '수', '목', '금'].map(day => `
            <div class="time-field" id="time-${day}" style="display: none;">
              <h4>${day}요일 강의 시간</h4>
              <label>시작 교시:
                <select name="startPeriod_${day}">
                  ${generatePeriodOptions()}
                </select>
              </label>
              <label>종료 교시:
                <select name="endPeriod_${day}">
                  ${generatePeriodOptions()}
                </select>
              </label>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="submit-area">
        <button type="submit" class="submit-button">강의 추가</button>
      </div>
    </form>
  `;

  // 요일 선택 시 시간 입력 필드 보이기
  document.getElementById('days').addEventListener('change', function () {
    const selectedDays = Array.from(this.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
    ['월', '화', '수', '목', '금'].forEach(day => {
      document.getElementById(`time-${day}`).style.display = selectedDays.includes(day) ? 'block' : 'none';
    });
  });
}

//강의 추가 폼 제출 시 서버로 전송하고 결과 처리 
async function submitCourseApplication(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const courseData = {
    courseCode: formData.get('courseCode'),
    courseName: formData.get('courseName'),
    campus: formData.get('campus'),
    educationType: formData.get('educationType'),
    faculty: formData.get('college'),
    department: formData.get('department'),
    year: formData.getAll('year[]').join(','),
    section: formData.get('section'),
    professorID: formData.get('professorID'),
    maxStudents: formData.get('maxStudents'),
    days: formData.getAll('days[]').join(','),
    schedule: {}
  };

  const daysOfWeek = ['월', '화', '수', '목', '금'];
  for (const day of daysOfWeek) {
    const startPeriod = formData.get(`startPeriod_${day}`);
    const endPeriod = formData.get(`endPeriod_${day}`);
    console.log(`DEBUG - ${day}요일: 시작 교시 선택값: ${startPeriod}, 종료 교시 선택값: ${endPeriod}`);
    if (startPeriod && endPeriod) {
      if (Number(startPeriod) > Number(endPeriod)) {
        alert(`${day}요일 강의의 시작 교시는 종료 교시보다 클 수 없습니다.`);
        return;
      }
      courseData.schedule[day] = {
        startPeriod: Number(startPeriod),
        endPeriod: Number(endPeriod)
      };
    }
  }

  console.log("전송 데이터:", courseData);

  try {
    const response = await fetch('/api/course/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseData),
    });

    if (response.ok) {
      alert('강의가 성공적으로 추가되었습니다!');
    } else {
      alert('강의 추가 실패. 다시 시도해 주세요.');
    }
  } catch (error) {
    console.error('Error submitting form:', error);
    alert('강의 추가 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }
}

// 강의 시간에 따른 시간 입력 필드 토글
//요일 체크 여부에 따라 시간 입력 필드 표시, 숨김 처리 
function toggleTimeFields(checkbox) {
  const day = checkbox.value;
  const timeDiv = document.getElementById('time-' + day);
  if (checkbox.checked) {
    timeDiv.style.display = 'block';
  } else {
    timeDiv.style.display = 'none';
  }
}

//상단에 오늘 날짜 표시하는 기능
function updateTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = ('0' + (today.getMonth() + 1)).slice(-2);
  const date = ('0' + today.getDate()).slice(-2);
  const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const day = dayNames[today.getDay()];
  document.getElementById('today-date').innerText = `${year}년 ${month}월 ${date}일 ${day}`;
}

window.onload = updateTodayDate;

window.onclick = function(event) {
  const modal = document.getElementById('attendanceModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
};

function manageGrades() {
  const selectBox = document.querySelector('.lecture-select');
  const selectedValue = selectBox.value;
  const professorId = localStorage.getItem("studentId");

  if (!selectedValue || !professorId) {
    document.getElementById('details').innerHTML = '강의를 선택해주세요.';
    return;
  }

  const [courseCode, section] = selectedValue.split('-');

  // ✅ 성적 재조회
  fetch(`/prof/grades?courseCode=${courseCode}&section=${section}&professorId=${professorId}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        document.getElementById('details').innerHTML = '성적을 불러오는 중 오류가 발생했습니다.';
        return;
      }

      const rows = data.grades || [];

      const tableHTML = `
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>학번</th>
              <th>학년</th>
              <th>학과</th>
              <th>출석</th>
              <th>과제</th>
              <th>중간</th>
              <th>기말</th>
              <th>합계</th>
              <th>등급</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(st => {
              const ATT = st.ATT ?? '';
              const ASSIGN = st.ASSIGNMENT ?? '';
              const MID = st.MIDTERM ?? '';
              const FIN = st.FINAL ?? '';
              const TOT = st.TOT ?? 0;
              const GRADE = st.GRADE ?? '';

              return `
                <tr>
                  <td>${st.STUDENT_NAME}</td>
                  <td>${st.STUDENT_ID}</td>
                  <td>${st.YEAR_GRADE}</td>
                  <td>${st.DEPARTMENT}</td>
                  <td><input type="number" placeholder="최대30" value="${ATT}" oninput="calculateTotal(this)"></td>
                  <td><input type="number" placeholder="최대20" value="${ASSIGN}" oninput="calculateTotal(this)"></td>
                  <td><input type="number" placeholder="최대20" value="${MID}" oninput="calculateTotal(this)"></td>
                  <td><input type="number" placeholder="최대30" value="${FIN}" oninput="calculateTotal(this)"></td>
                  <td class="total-cell">${TOT}</td>
                  <td class="grade-cell">${GRADE}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="text-align:right; margin-top:10px;">
          <button class="submit-button" onclick="saveGrades()">성적 저장</button>
        </div>
      `;

      document.getElementById('details').innerHTML = tableHTML;
    })
    .catch(err => {
      console.error('성적 로딩 오류:', err);
      document.getElementById('details').innerHTML = '성적을 불러오는 중 오류가 발생했습니다.';
    });

  highlightSelectedButton('gradesBtn');
}

async function saveGrades() {
  const rows = document.querySelectorAll('#details tbody tr');
  const selectBox = document.querySelector('.lecture-select');
  const [courseCode, section] = selectBox.value.split('-');
  const professorId = localStorage.getItem("studentId");

  const res = await fetch(`/rollbook-data?courseCode=${courseCode}&section=${section}`);
  const rollData = await res.json();
  const rollbookMap = {};

  rollData.students.forEach(stu => {
    let absenceCount = 0;
    for (let date in stu.attendance) {
      if (stu.attendance[date] === '결석') absenceCount++;
    }
    rollbookMap[stu.S_ID] = absenceCount;
  });

  const payload = [];

  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const studentId = row.children[1].textContent;
    const absence = rollbookMap[studentId] || 0;

    let att = parseInt(inputs[0].value) || 0;
    let assignment = parseInt(inputs[3].value) || 0;
    let midterm = parseInt(inputs[1].value) || 0;
    let finalExam = parseInt(inputs[2].value) || 0;
    let total = att + assignment+ midterm + finalExam;

    const totalCell = row.querySelector('.total-cell');

    if (absence >= 5) {
      att = midterm = finalExam = assignment = total = 0;
      totalCell.textContent = 'F';
      totalCell.style.color = 'red';
    } else {
      totalCell.textContent = total;
      totalCell.style.color = 'black';
    }

    payload.push({
      att, midterm, finalExam, assignment, total,
      courseCode, section, studentId, professorId
    });
  });

  alert('성적 저장 요청을 보냅니다...');

  const response = await fetch('/submit-achievement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grades: payload })
  });

  const result = await response.json();
  if (result.success) {
    alert('성적 저장 완료!');
    manageGrades();
  } else {
    alert('성적 저장 실패');
  }
}

//입력된 항목의 합계 자동계산 
function calculateTotal(input) {
  const row = input.closest('tr');
  const inputs = row.querySelectorAll('input');
  let total = 0;
  inputs.forEach(inp => {
    total += parseInt(inp.value) || 0;
  });
  row.querySelector('.total-cell').textContent = total;
}

//출석부
function generateAttendanceDates(startDate, endDate, dayStr) {
  const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  const targetDays = dayStr.split(',').map(d => dayMap[d.trim()]);
  const result = [];

  let current = new Date(startDate);
  while (current <= endDate) {
    if (targetDays.includes(current.getDay())) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      result.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
}

//출석부 16주간 출결 표시 테이블 구현
function viewRollbook() {
  const selectBox = document.querySelector('.lecture-select');
  const selectedValue = selectBox.value;

  if (!selectedValue) {
    document.getElementById('details').innerHTML = '강의를 선택해주세요.';
    return;
  }

  const [courseCode, section] = selectedValue.split('-');

  // 1. 요일 정보부터 가져오기
  fetch(`/get-course-days?courseCode=${courseCode}&section=${section}`)
    .then(res => res.json())
    .then(dayData => {
      if (!dayData.success) {
        document.getElementById('details').innerHTML = '요일 정보를 불러오지 못했습니다.';
        return;
      }

      const dayStr = dayData.days; // 예: "월,수"
      const allDates = generateAttendanceDates(new Date("2025-03-03"), new Date("2025-06-23"), dayStr);
      const formattedDates = allDates.map(dateStr => {
        const [year, month, day] = dateStr.split('-');
        return `${parseInt(month)}/${parseInt(day)}`;
      });

      // 2. 학생 + 출석 데이터
      fetch(`/rollbook-data?courseCode=${courseCode}&section=${section}`)
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            document.getElementById('details').innerHTML = '출석부 데이터를 불러오는 데 실패했습니다.';
            return;
          }

          const students = data.students;
          const statusSymbol = {
            '출석': '◯',
            '결석': '✕',
            '지각': '△',
            '공결': '□'
          };

          // 3. 출석부 테이블 구성
          let table = `
            <table class="rollbook-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>학번</th>
                  <th>학과</th>
                  ${formattedDates.map(label => `<th>${label}</th>`).join('')}
                  <th>등급</th> <!-- 등급 추가 -->
                </tr>
              </thead>
              <tbody>
                ${students.map(stu => {
                  let absenceCount = 0;

                  const attendanceCells = allDates.map(date => {
                    const rawStatus = stu.attendance?.[date];
                    if (rawStatus === '결석') absenceCount++;
                    const symbol = statusSymbol[rawStatus] || '-';
                    return `<td>${symbol}</td>`;
                  }).join('');

                  const grade = (absenceCount >= 5) ? 'F' : ''; // F 처리

                  return `
                    <tr>
                      <td>${stu.NAME}</td>
                      <td>${stu.S_ID}</td>
                      <td>${stu.DEPARTMENT}</td>
                      ${attendanceCells}
                      <td>${grade}</td> <!-- 등급 표시 -->
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `;

          document.getElementById('details').innerHTML = table;
        });
    })
    .catch(err => {
      console.error('요일 또는 출석부 조회 오류:', err);
      document.getElementById('details').innerHTML = '출석부 정보를 불러오는 중 오류가 발생했습니다.';
    });

  highlightSelectedButton('rollbookBtn');
}

//선택된 버튼 색 변경
function highlightSelectedButton(activeId) {
  const btnIds = ['attendanceBtn', 'gradesBtn', 'rollbookBtn'];
  btnIds.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      if (id === activeId) {
        btn.style.backgroundColor = 'white';
        btn.style.color = '#2c4e9c';
        btn.style.border = '2px solid #2c4e9c';
      } else {
        btn.style.backgroundColor = '#2c4e9c';
        btn.style.color = 'white';
        btn.style.border = '2px solid #2c4e9c';
      }
    }
  });
}
