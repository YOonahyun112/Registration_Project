/* mainscript.js */
let originalCourseList = [];  // 조건 필터용 원본 데이터

document.addEventListener("DOMContentLoaded", function() {
    // 탭 전환 기능
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
        button.addEventListener("click", function() {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(tab => tab.classList.remove("active"));

            this.classList.add("active");
            document.getElementById(this.dataset.tab).classList.add("active");

             if (button.dataset.tab === "retake") {
            loadRetakeCourses();
            }
        });
    });

    // 페이지 로드 시 사용자 정보 표시
    const username = localStorage.getItem("username");
    const studentId = localStorage.getItem("studentId");
    const department = localStorage.getItem("department");

    if (username && studentId) {
        document.getElementById("userDisplay").textContent = `${username}(${studentId}) | ${department}`;
    } else {
        document.getElementById("userDisplay").textContent = "로그인 정보 없음";
    }

    // 시간표 생성
    generateTimetable();
});

/*
//초기로딩
document.addEventListener("DOMContentLoaded", function () {
    fetch("/all-courses")
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error("과목 불러오기 실패");
  
        originalCourseList = data.courses.map(course => ({
          ...course,
          rowElement: buildCourseRow(course)
        }));
  
        const tbody = document.getElementById("course-list");
        originalCourseList.forEach(item => tbody.appendChild(item.rowElement));
        updateCheckboxes();
      })
      .catch(err => console.error("초기 과목 로딩 실패:", err));
  });
  */

document.addEventListener("DOMContentLoaded", function () {
  fetch("/all-courses")
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error("과목 불러오기 실패");

      const currentDepartment = localStorage.getItem("department");
      const currentYearGrade = localStorage.getItem("yearGrade");

      const tbody = document.getElementById("course-list");
      tbody.innerHTML = "";

      originalCourseList = data.courses.map(course => {
        const isSameMajor = course.DEPARTMENT === currentDepartment;
        const isSameGrade = course.YEAR_GRADE === String(currentYearGrade) || course.YEAR_GRADE === "1,2,3,4";
        const isMajor = course.MAJOR_CATEGORY === "전공";

        const shouldShow = isMajor && isSameMajor && isSameGrade;

        const rowElement = buildCourseRow(course);
        if (!shouldShow) rowElement.classList.add("hidden-course");

        tbody.appendChild(rowElement);

        return {
          ...course,
          rowElement
        };
      });

      updateCheckboxes();
    })
    .catch(err => console.error("초기 과목 로딩 실패:", err));
});


  //백에서 전체 과목 데이터 받아 originalCourseList에 저장하고,html 테이블에 한줄씩 추가
  function buildCourseRow(course) {
    const row = document.createElement("tr");
    row.setAttribute("data-code", course.COURSE_CODE);
    row.setAttribute("data-section", course.CLASS_SECTION);
    row.innerHTML = `
      <td>${course.MAJOR_CATEGORY}</td>
      <td><button class="wishlist-btn" onclick="addToWishlist(this)">♡</button></td>
      <td>${course.YEAR_GRADE === '1,2,3,4' ? '전학년' : course.YEAR_GRADE}</td>
      <td>${course.COURSE_NAME}</td>
      <td><input type="checkbox" onchange="toggleCourseConfirmation(this)" 
                 data-course-code="${course.COURSE_CODE}" 
                 data-class-section="${course.CLASS_SECTION}"></td>
      <td>${course.COURSE_CODE}</td>
      <td>${course.MAJOR_CATEGORY === '전공' ? 3 : 2}</td>
      <td>${course.CLASS_SECTION}</td>
      <td>${course.PROFESSOR_NAME}</td>
      <td>${formatSchedule(course.DAY_OF_WEEK, course.S_TIME, course.E_TIME)}</td>
      <td>${course.CAMPUS}</td>
    `;
    return row;
  }
  
// 개설 교과목 조회 필터링용 함수
function handleFilterSearch() {
    const selects = document.querySelectorAll(".search-bar")[0].querySelectorAll("select");
    const department = selects[0].value;
    const major = selects[1].value;
    const year = selects[2].value;
  
    const tbody = document.getElementById("course-list");
    tbody.innerHTML = "";
  
    const filtered = originalCourseList.filter(item => {
        //학과(학부)가 선택되면 모든학과 통과, 아니라면 해당과목에 학과명이 사용자가 선택한 학가명을 포함하고 있어야 통과과
        const depMatch = (department === "학과(학부)" || item.DEPARTMENT.includes(department));
        //전공영역, 교양영역이면 major_category가 정확히 일치해야함
        //영역이 선책된 경우에는 모든 과목 허용
        //위 조건에 맞지 않으면 major_category가 선택값과 정확히 일치해야함함
        const majorMatch = (major === "전공영역" || major === "교양영역") 
          ? item.MAJOR_CATEGORY === major
          : (major === "전공" || major === "교양")  
            ? item.MAJOR_CATEGORY === major
            : (major === "영역")
              ? true
              : item.MAJOR_CATEGORY === major;
      
        //전학년이 선택된 경우라면 '1,2,3,4'와 정확히 일치하는 과목만 허용
        //아니라면 1학년-> "1"으로 변경후 year_grade에 포함되는지 검사
        const yearMatch =
          year === "1,2,3,4"
            ? item.YEAR_GRADE === "1,2,3,4"
            : item.YEAR_GRADE.includes(year.replace("학년", ""));
      
        return depMatch && majorMatch && yearMatch;
      });
      
  
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11">조건에 맞는 과목이 없습니다.</td></tr>`;
    } else {
      filtered.forEach(item => tbody.appendChild(item.rowElement));
    }
  
    updateCheckboxes();
  }
  

// DOMContentLoaded 내에서 버튼에 이벤트 연결
document.addEventListener("DOMContentLoaded", function () {
    const filterButton = document.querySelectorAll(".search-bar")[0].querySelector("button");
    filterButton.addEventListener("click", handleFilterSearch);
    document.querySelectorAll(".search-bar")[0].querySelector("button").addEventListener("click", handleFilterSearch);

});

// 필터링 함수 예제
function filterCourses(department, general, year) {
    const rows = document.querySelectorAll("#course-list tr");
    rows.forEach(row => {
        const courseDepartment = row.cells[2].textContent;
        const courseYear = row.cells[3].textContent;

        if (
            (department === "학과(학부)" || courseDepartment.includes(department)) &&
            (year === "학년" || courseYear.includes(year))
        ) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }   
    });
}
//드롭다운 데이터 끌고와서 select 요소에 추가
document.addEventListener("DOMContentLoaded", function () {
    fetch('/dropdown-options')
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error("드롭다운 불러오기 실패");
  
        const [departmentSelect, majorSelect, yearSelect] = document.querySelectorAll(".search-bar")[0].querySelectorAll("select");
  
        // 학과
        data.departments.forEach(dep => {
          const option = document.createElement("option");
          option.value = dep;
          option.textContent = dep;
          departmentSelect.appendChild(option);
        });
  
        // 전공 (영역)
        data.majors.forEach(major => {
          const option = document.createElement("option");
          option.value = major;
          option.textContent = major;
          majorSelect.appendChild(option);
        });
  
        // 학년
        data.years.forEach(year => {
          const option = document.createElement("option");
          option.value = year;
          option.textContent = (year === "1,2,3,4") ? "전학년" : `${year}학년`;
          yearSelect.appendChild(option);
        });
      })
      .catch(err => {
        console.error("드롭다운 로딩 오류:", err);
      });
  });
  
function searchByKeyword(keyword) {
    // TODO: 키워드 검색 로직 작성
    alert(`키워드 조회: ${keyword}`);
}

function handleKeywordSearch() {
    const keywordInput = document.getElementById("keywordInput");
    const keyword = keywordInput.value.trim();

    if (keyword === "") {
        alert("키워드를 입력하세요.");
        return;
    }

    console.log("검색어:", keyword);
    searchByKeyword(keyword);
}

// 시간표 생성: 9:00부터 30분 단위로 18개 행 (0교시 ~ 17교시)
function generateTimetable() {
    const tbody = document.querySelector("#timetable tbody");
    tbody.innerHTML = "";
    const startHour = 9;
    for (let period = 0; period < 18; period++) {
        const totalMinutes = period * 30;
        const hour = startHour + Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const endTotal = totalMinutes + 30;
        const endHour = startHour + Math.floor(endTotal / 60);
        const endMinute = endTotal % 60;
        const formatTime = (h, m) => `${h}:${m.toString().padStart(2, '0')}`;
        const timeLabel = `${formatTime(hour, minute)} ~ ${formatTime(endHour, endMinute)}`;
        const periodLabel = `${period}교시`;

        const row = document.createElement("tr");
        const timeCell = document.createElement("td");
        // 교시 번호와 시간 정보를 두 줄로 표시
        timeCell.innerHTML = `<div>${periodLabel}</div><div>${timeLabel}</div>`;
        row.appendChild(timeCell);
        // 월~금 (5일)
        for (let i = 0; i < 5; i++) {
            const cell = document.createElement("td");
            cell.textContent = "";
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    }
}

// 위시리스트(희망과목) 관련 함수들
function updateWishlistInAllTabs(courseCode, section, isWished) {
  const selector = `tr[data-code="${courseCode}"][data-section="${section}"] .wishlist-btn`;
  document.querySelectorAll(selector).forEach(btn => {
    if (isWished) {
      btn.textContent = "♥";
      btn.classList.add("active");
      btn.setAttribute("onclick", "removeFromWishlist(this)");
    } else {
      btn.textContent = "♡";
      btn.classList.remove("active");
      btn.setAttribute("onclick", "addToWishlist(this)");
    }
  });
}
// 서버에서 wishlist 불러오기
// 서버에서 wishlist 불러오기
async function loadWishlist() {
  const studentId = localStorage.getItem("studentId");
  const wishlistList = document.getElementById("wishlist-list");
  wishlistList.innerHTML = "";

  try {
    const res = await fetch(`/wishlist?studentId=${studentId}`);
    const data = await res.json();
    if (!data.success) throw new Error("불러오기 실패");

    const enrollmentStatus = JSON.parse(localStorage.getItem("enrollmentStatus") || '{}');
    const wishlistMap = {};

    data.wishlist.forEach(item => {
      const key = `${item.COURSE_CODE}-${item.CLASS_SECTION}`;
      wishlistMap[key] = true;

      // ✅ 모든 탭 동기화
      updateWishlistInAllTabs(item.COURSE_CODE, item.CLASS_SECTION, true);

      // 희망 탭에 추가
      const row = document.querySelector(
        `#course-list tr[data-code="${item.COURSE_CODE}"][data-section="${item.CLASS_SECTION}"]`
      );
      if (row) {
        const newRow = row.cloneNode(true);
        newRow.setAttribute("data-unique-id", `${item.COURSE_CODE}_${item.CLASS_SECTION}`);

        // 버튼 ♥ 로
        const wishlistBtn = newRow.querySelector(".wishlist-btn");
        wishlistBtn.textContent = "♥";
        wishlistBtn.classList.add("active");
        wishlistBtn.setAttribute("onclick", "removeFromWishlist(this)");

        // 체크박스 반영
        const checkbox = newRow.querySelector("input[type='checkbox']");
        if (checkbox) {
          checkbox.checked = enrollmentStatus[key] === "신청";
        }

        wishlistList.appendChild(newRow);
      }
    });

    localStorage.setItem("wishlistMap", JSON.stringify(wishlistMap));
  } catch (error) {
    console.error("wishlist 불러오기 실패:", error);
  }
}


  // wishlist에 과목 추가
// ✅ 희망 추가
async function addToWishlist(button) {
  const row = button.closest("tr");
  const code = row.getAttribute("data-code");
  const section = row.getAttribute("data-section");
  const studentId = localStorage.getItem("studentId");
  const uniqueId = `${code}_${section}`;
  const wishlistList = document.getElementById("wishlist-list");

  // 이미 희망탭에 있으면 중복 방지
  if (wishlistList.querySelector(`tr[data-unique-id="${uniqueId}"]`)) {
    alert("이미 희망과목에 등록되어 있습니다.");
    return;
  }

  try {
    const res = await fetch("/wishlist/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, courseCode: code, section }),
    });
    const data = await res.json();
    if (!data.success) throw new Error("서버 저장 실패");

    // ✅ 1) 로컬 상태 갱신
    const wishlistMap = JSON.parse(localStorage.getItem("wishlistMap") || "{}");
    wishlistMap[`${code}-${section}`] = true;
    localStorage.setItem("wishlistMap", JSON.stringify(wishlistMap));

    // ✅ 2) 희망탭에 행 추가
    const newRow = row.cloneNode(true);
    newRow.setAttribute("data-unique-id", uniqueId);

    const wishlistBtn = newRow.querySelector(".wishlist-btn");
    wishlistBtn.textContent = "♥";
    wishlistBtn.classList.add("active");
    wishlistBtn.setAttribute("onclick", "removeFromWishlist(this)");

    wishlistList.appendChild(newRow);

    // ✅ 3) 모든 탭 버튼 ♥ 동기화
    updateWishlistInAllTabs(code, section, true);

    alert("희망과목에 추가되었습니다.");
  } catch (error) {
    console.error("wishlist 추가 실패:", error);
    alert("과목 추가에 실패했습니다.");
  }
  updateWishlistInAllTabs(code, section, true);
}

// ✅ 희망 해제
async function removeFromWishlist(button) {
  const row = button.closest("tr");
  const code = row.getAttribute("data-code");
  const section = row.getAttribute("data-section");
  const studentId = localStorage.getItem("studentId");
  const uniqueId = `${code}_${section}`;

  try {
    const res = await fetch("/wishlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, courseCode: code, section }),
    });
    const data = await res.json();
    if (!data.success) throw new Error("서버 삭제 실패");

    // ✅ 1) 로컬 상태 갱신
    const wishlistMap = JSON.parse(localStorage.getItem("wishlistMap") || "{}");
    delete wishlistMap[`${code}-${section}`];
    localStorage.setItem("wishlistMap", JSON.stringify(wishlistMap));

    // ✅ 2) 희망탭에서 행 제거
    const wishlistList = document.getElementById("wishlist-list");
    const inWishlist = wishlistList.querySelector(`tr[data-unique-id="${uniqueId}"]`);
    if (inWishlist) inWishlist.remove();

    // ✅ 3) 모든 탭 버튼 ♡ 동기화
    updateWishlistInAllTabs(code, section, false);

    alert("희망과목에서 해지되었습니다.");
  } catch (error) {
    console.error("wishlist 제거 실패:", error);
    alert("과목 제거에 실패했습니다.");
  }
  updateWishlistInAllTabs(code, section, false);
}

  // ✅ 재수강 과목 불러오기
async function loadRetakeCourses() {
  const studentId = localStorage.getItem("studentId");
  const tbody = document.getElementById("retake-list");
  tbody.innerHTML = "";

  try {
    const res = await fetch(`/retake-courses?studentId=${studentId}`);
    const data = await res.json();
    if (!data.success) throw new Error("재수강 과목 불러오기 실패");

    if (data.courses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11">재수강 가능한 과목이 없습니다.</td></tr>`;
      return;
    }

    // ✅ localStorage에 저장된 희망과목 불러오기
    const wishlistMap = JSON.parse(localStorage.getItem("wishlistMap") || "{}");

    data.courses.forEach(course => {
      const key = `${course.COURSE_CODE}-${course.CLASS_SECTION}`;
      const isWished = !!wishlistMap[key];

      const row = document.createElement("tr");
      row.setAttribute("data-code", course.COURSE_CODE);
      row.setAttribute("data-section", course.CLASS_SECTION);
      row.setAttribute("data-unique-id", `${course.COURSE_CODE}_${course.CLASS_SECTION}`);
      row.innerHTML = `
        <td>${course.MAJOR_CATEGORY}</td>
        <td>
          <button class="wishlist-btn ${isWished ? "active" : ""}" 
                  onclick="${isWished ? "removeFromWishlist(this)" : "addToWishlist(this)"}">
            ${isWished ? "♥" : "♡"}
          </button>
        </td>
        <td>${course.YEAR_GRADE}</td>
        <td>${course.COURSE_NAME}</td>
        <td><input type="checkbox" onchange="toggleCourseConfirmation(this)" 
                   data-course-code="${course.COURSE_CODE}" 
                   data-class-section="${course.CLASS_SECTION}"></td>
        <td>${course.COURSE_CODE}</td>
        <td>${course.MAJOR_CATEGORY === '전공' ? 3 : 2}</td>
        <td>${course.CLASS_SECTION}</td>
        <td>${course.PROFESSOR_NAME}</td>
        <td>${formatSchedule(course.DAY_OF_WEEK, course.S_TIME, course.E_TIME)}</td>
        <td>${course.CAMPUS}</td>
      `;
      tbody.appendChild(row);
    });

    updateCheckboxes();
  } catch (err) {
    console.error("재수강 로딩 오류:", err);
    tbody.innerHTML = `<tr><td colspan="11">재수강 과목을 불러오는 중 오류 발생</td></tr>`;
  }
}


// 로그아웃 함수
function logout() {
    localStorage.removeItem("username");
    localStorage.removeItem("studentId");
    alert('로그아웃 되었습니다.');
    window.location.href = "/login";
}

// 시간표 관련 함수

// 요일 문자 -> 시간표 열 인덱스 매핑 (시간 열이 0번째, 월~금은 1~5번째)
const dayMapping = {
    "월": 1,
    "화": 2,
    "수": 3,
    "목": 4,
    "금": 5
};

// parsePeriods 함수: 기간 문자열을 배열로 변환 (예: "1~3,5" → [1,2,3,5])
function parsePeriods(periodsStr) {
    const periods = [];
    // 쉼표로 구분하여 처리
    const parts = periodsStr.split(",");
    parts.forEach(part => {
        part = part.trim();
        if (part.includes("~")) {
            // 범위로 표현된 경우 (예: "1~6")
            const [start, end] = part.split("~").map(num => parseInt(num.trim(), 10));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                    periods.push(i);
                }
            }
        } else {
            // 단일 숫자인 경우
            const num = parseInt(part, 10);
            if (!isNaN(num)) {
                periods.push(num);
            }
        }
    });
    return periods;
}

// 시간표 셀 중복 체크 함수
function checkTimeConflict(scheduleInfo, courseName) {
    const parts = scheduleInfo.split("/");
    for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        // 첫 문자는 요일 (예: "월")
        const day = part.charAt(0);
        let periodsPart = part.slice(1).trim();
        const periods = parsePeriods(periodsPart);
        const colIndex = dayMapping[day];
        if (!colIndex) continue;
        for (let p of periods) {
            const periodNum = parseInt(p, 10);
            if (isNaN(periodNum)) continue;
            const tbody = document.querySelector("#timetable tbody");
            const row = tbody.children[periodNum - 1]; // 1교시는 children[0]
            if (!row) continue;
            const cell = row.children[colIndex];
            if (cell.textContent && cell.textContent !== courseName) {
                return true;
            }
        }
    }
    return false;
}

function addCourseToTimetable(scheduleInfo, courseName) {
    const parts = scheduleInfo.split(",");
    parts.forEach(part => {
        part = part.trim();
        if (part.length === 0) return;
        const day = part.charAt(0);
        let periodsPart = part.slice(1).trim();
        const periods = parsePeriods(periodsPart);
        const colIndex = dayMapping[day];
        if (!colIndex) return;
        periods.forEach(p => {
            const periodNum = parseInt(p, 10);
            if (isNaN(periodNum)) return;
            const tbody = document.querySelector("#timetable tbody");
            const row = tbody.children[periodNum];
            if (!row) return;
            const cell = row.children[colIndex]; 
            if (cell.textContent) {
                cell.textContent += `, ${courseName}`;
            } else {
                cell.textContent = courseName;
            }
        });
    });
}

function removeCourseFromTimetable(scheduleInfo, courseName) {
    const parts = scheduleInfo.split(",");
    parts.forEach(part => {
        part = part.trim();
        if (part.length === 0) return;
        const day = part.charAt(0);
        let periodsPart = part.slice(1).trim();
        const periods = parsePeriods(periodsPart);
        const colIndex = dayMapping[day];
        if (!colIndex) return;
        periods.forEach(p => {
            const periodNum = parseInt(p, 10);
            if (isNaN(periodNum)) return;
            const tbody = document.querySelector("#timetable tbody");
            const row = tbody.children[periodNum];
            if (!row) return;
            const cell = row.children[colIndex];
            if (cell.textContent === courseName) {
                cell.textContent = "";
            } else {
                const courses = cell.textContent.split(",").map(s => s.trim()).filter(name => name !== courseName);
                cell.textContent = courses.join(", ");
            }
        });
    });
}

function toggleCourseConfirmation(checkbox) {
    const row = checkbox.closest("tr");
    const courseCode = row.dataset.code;
    const section = row.dataset.section;
    const courseName = row.cells[3].textContent;
    const scheduleInfo = row.cells[9].textContent;  // 예: "월 1~6 교시"
    const uniqueId = courseCode + "_" + section;  // 위시리스트에서 사용되는 고유 ID

    if (checkbox.checked) {
        if (checkTimeConflict(scheduleInfo, courseName)) {
            alert("시간이 중복되는 강의가 존재하여 신청할 수 없습니다.");
            checkbox.checked = false;
            return;
        }
        enrollCourse(courseCode, section, courseName)
            .then(data => {
                if (data.success) {
                    addCourseToTimetable(scheduleInfo, courseName);
                    // 위시리스트에 등록되어 있다면 상태 업데이트
                    updateCheckboxInAllTabs(courseCode, section, true);
                    alert(`${courseName} 수강신청이 완료되었습니다.`);
                } else {
                    alert(data.message || `${courseName} 수강신청에 실패했습니다.`);
                    checkbox.checked = false;
                }
            })
            .catch(error => {
                console.error("Error:", error);
                alert("네트워크 오류가 발생했습니다.");
                checkbox.checked = false;
            });
    } else {
        cancelEnrollment(courseCode, section, courseName)
            .then(data => {
                if (data.success) {
                    removeCourseFromTimetable(scheduleInfo, courseName);
                    // 취소 시 위시리스트 상태는 변경하지 않고 개설과목 체크박스만 업데이트
                    updateCheckboxInAllTabs(courseCode, section, false);
                    alert(`${courseName} 수강 취소가 완료되었습니다. 희망과목 목록은 그대로 유지됩니다.`);
                } else {
                    alert("수강 취소에 실패했습니다.");
                    checkbox.checked = true;
                }
            })
            .catch(error => {
                console.error("Error:", error);
                alert("네트워크 오류가 발생했습니다.");
                checkbox.checked = true;
            });
    }
}


// 수강 신청 함수 (Promise 반환)
function enrollCourse(courseCode, section, courseName) {
    const studentId = localStorage.getItem("studentId");
    if (!studentId) {
        alert("로그인된 사용자가 아닙니다. 다시 로그인해주세요.");
        return Promise.reject("로그인 정보 없음");
    }
    return fetch('/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, courseCode, section })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateLocalStorage(courseCode, section, "신청");
        }
        return data;
    });
}

// 수강 취소 함수 (Promise 반환)
function cancelEnrollment(courseCode, section, courseName) {
    const studentId = localStorage.getItem("studentId");
    if (!studentId) {
        alert("로그인된 사용자가 아닙니다. 다시 로그인해주세요.");
        return Promise.reject("로그인 정보 없음");
    }
    return fetch('/cancel-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, courseCode, section })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateLocalStorage(courseCode, section, "취소");
        }
        return data;
    });
}

function updateLocalStorage(courseCode, section, status) {
    const enrollmentStatus = JSON.parse(localStorage.getItem("enrollmentStatus") || '{}');
    enrollmentStatus[`${courseCode}-${section}`] = status;
    localStorage.setItem("enrollmentStatus", JSON.stringify(enrollmentStatus));
}

// 수강신청 상태(체크박스) 업데이트
function updateCheckboxes() {
  const enrollmentStatus = JSON.parse(localStorage.getItem("enrollmentStatus") || "{}");
  document.querySelectorAll("#course-list tr, #wishlist-list tr, #retake-list tr").forEach(row => {
      const courseCode = row.getAttribute("data-code");
      const section = row.getAttribute("data-section");
      const key = `${courseCode}-${section}`;
      const checkbox = row.querySelector("input[type='checkbox']");
      if (checkbox) {
          checkbox.checked = enrollmentStatus[key] === "신청";
      }
  });
}


function updateCheckboxInAllTabs(courseCode, section, isChecked) {
    const selector = `tr[data-code="${courseCode}"][data-section="${section}"] input[type="checkbox"]`;
    document.querySelectorAll(selector).forEach(input => {
        input.checked = isChecked;
    });
}


// 새로 고침 시 수강신청된 강의들을 시간표에 반영
function updateTimetableFromEnrollments() {
    const enrollmentStatus = JSON.parse(localStorage.getItem("enrollmentStatus") || "{}");
    document.querySelectorAll("#course-list tr").forEach(row => {
        const courseCode = row.getAttribute("data-code");
        const section = row.getAttribute("data-section");
        const key = `${courseCode}-${section}`;
        if (enrollmentStatus[key] === "신청") {
            const courseName = row.cells[3].textContent;
            const scheduleInfo = row.cells[9].textContent;
            addCourseToTimetable(scheduleInfo, courseName);
        }
    });
}

// 페이지 로드 시 수강신청 상태를 가져온 후 시간표 업데이트
document.addEventListener("DOMContentLoaded", function () {
    const studentId = localStorage.getItem("studentId");

    if (!studentId) {
        alert("로그인된 사용자가 아닙니다.");
        return;
    }

    fetch(`/enrollments?studentId=${studentId}`)
        .then(response => response.json())
        .then(data => {
            console.log("📌 서버 응답 데이터:", data);

            if (data.success) {
                const enrollments = data.enrollments;
                const enrollmentStatus = {};
                enrollments.forEach(enrollment => {
                    const key = `${enrollment.COURSE_CODE}-${enrollment.CLASS_SECTION}`;
                    enrollmentStatus[key] = enrollment.STATUS;
                });
                localStorage.setItem("enrollmentStatus", JSON.stringify(enrollmentStatus));
                updateCheckboxes();
                updateTimetableFromEnrollments();
            } else {
                alert("수강신청 상태를 가져오는 데 실패했습니다.");
            }
        })
        .catch(error => {
            console.error("네트워크 오류 발생:", error);
            alert("네트워크 오류가 발생했습니다.");
        });
});

// 탭 전환 및 저장 기능
document.addEventListener("DOMContentLoaded", function() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    let activeTab = localStorage.getItem("activeTab") || "courses";

    tabButtons.forEach(button => {
        if (button.dataset.tab === activeTab) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });
    tabContents.forEach(tab => {
        if (tab.id === activeTab) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    tabButtons.forEach(button => {
        button.addEventListener("click", function() {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(tab => tab.classList.remove("active"));

            this.classList.add("active");
            document.getElementById(this.dataset.tab).classList.add("active");

            localStorage.setItem("activeTab", this.dataset.tab);
        });
    });

    generateTimetable();
});

// (중복된 탭 전환 코드가 있다면 필요에 따라 정리)
document.addEventListener("DOMContentLoaded", function() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    let activeTab = localStorage.getItem("activeTab") || "courses";

    tabButtons.forEach(button => {
        if (button.dataset.tab === activeTab) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });
    tabContents.forEach(tab => {
        if (tab.id === activeTab) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    tabButtons.forEach(button => {
        button.addEventListener("click", function() {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(tab => tab.classList.remove("active"));

            this.classList.add("active");
            document.getElementById(this.dataset.tab).classList.add("active");

            localStorage.setItem("activeTab", this.dataset.tab);
        });
    });

    generateTimetable();
});

//검색 기능 (백엔드에서 키워드 검색)
function handleKeywordSearch() {
    const keyword = document.getElementById("keywordInput").value.trim();
    if (!keyword) {
        alert("키워드를 입력하세요.");
        return;
    }

    fetch(`/search-courses?keyword=${encodeURIComponent(keyword)}`)
        .then(res => {
            if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.success && data.courses.length > 0) {
                updateCourseTable(data.courses);
            } else {
                alert("일치하는 과목이 없습니다.");
                updateCourseTable([]);
            }
        })
        .catch(err => {
            console.error("🔴 검색 실패:", err);
            alert("검색 중 오류가 발생했습니다.");
        });
}
window.handleKeywordSearch = handleKeywordSearch; // 버튼 연결용

// 검색 결과 테이블 업데이트
function updateCourseTable(courseList) {
    const tbody = document.getElementById("course-list");
    tbody.innerHTML = "";

    if (courseList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11">검색 결과가 없습니다.</td></tr>`;
        return;
    }

    courseList.forEach(course => {
        const row = document.createElement("tr");
        row.setAttribute("data-code", course.COURSE_CODE);
        row.setAttribute("data-section", course.CLASS_SECTION);
        row.innerHTML = `
            <td>${course.MAJOR_CATEGORY}</td>
            <td><button class="wishlist-btn" onclick="addToWishlist(this)">♡</button></td>
            <td>${course.YEAR_GRADE === '1,2,3,4' ? '전학년' : course.YEAR_GRADE}</td>
            <td>${course.COURSE_NAME}</td>
            <td>
                <input type="checkbox" onchange="toggleCourseConfirmation(this)" 
                       data-course-code="${course.COURSE_CODE}" 
                       data-class-section="${course.CLASS_SECTION}">
            </td>
            <td>${course.COURSE_CODE}</td>
            <td>${course.MAJOR_CATEGORY === '전공' ? 3 : 2}</td>
            <td>${course.CLASS_SECTION}</td>
            <td>${course.PROFESSOR_NAME}</td>
            <td>${formatSchedule(course.DAY_OF_WEEK, course.S_TIME, course.E_TIME)}</td>
            <td>${course.CAMPUS}</td>
        `;
        tbody.appendChild(row);
    });

    updateCheckboxes(); // 수강신청 체크 상태 반영
}

// 시간 텍스트 포맷
function formatSchedule(days, sTime, eTime) {
    const startTimes = JSON.parse(sTime);
    const endTimes = JSON.parse(eTime);
    return days.split(",").map((day, i) => `${day.trim()} ${startTimes[i]} ~ ${endTimes[i]}`).join(", ");
}

// 전역 연결
window.toggleCourseConfirmation = toggleCourseConfirmation;
window.updateCheckboxes = updateCheckboxes;
