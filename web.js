const express = require('express')
const ejs = require('ejs')
const web = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const db = require('./config/hanseodb')
const port = 4000
var session = require('express-session')

web.set('view engine', 'ejs')
web.set('views', './views')

web.use(express.json());
web.use(cors());
web.use(bodyParser.json())
web.use(bodyParser.urlencoded({extended: true}))
web.use(express.static(__dirname + '/public'))
web.use(session({ secret: 'hanseosugang', cookie: {maxAge: 60000}, resave: true, saveUninitialized: true}))

//로그인
web.get('/login', (req, res) => {
    res.render('login')
})
web.post('/loginProc', (req, res) => {
  const { studentId, password } = req.body;

  // 학생 테이블에서 조회
  const studentQuery = 'SELECT * FROM student WHERE s_id = ? AND password = ?';
  // 교수 테이블에서 조회
  const professorQuery = 'SELECT * FROM professor WHERE p_id = ? AND password = ?';

  db.query(studentQuery, [studentId, password], (err, studentResults) => {
      if (err) {
          console.error("DB 오류:", err);
          return res.json({ success: false, message: "서버 오류 발생" });
      }

      if (studentResults.length > 0) {
          // 학생 계정인 경우
          const studentName = studentResults[0].NAME; // 학생 이름 가져오기
          const department = studentResults[0].DEPARTMENT; // 학생 학과 가져오기
          const yearGrade = studentResults[0].YEAR_GRADE;  // 학년
          return res.json({
              success: true,
              userType: "student",
              username: studentName, // 이름을 username에 할당
              userdepartment: department,
              useryeargrade: yearGrade,
              message: "학생 로그인 성공",
              defaultTab: "courses"
          });
      } else {
          // 학생이 아니라면 교수 테이블도 확인
          db.query(professorQuery, [studentId, password], (err, professorResults) => {
              if (err) {
                  console.error("DB 오류:", err);
                  return res.json({ success: false, message: "서버 오류 발생" });
              }

              if (professorResults.length > 0) {
                  // 교수 계정인 경우
                  const professorName = professorResults[0].NAME; // 교수 이름 가져오기
                  const department = professorResults[0].DEPARTMENT; // 교수 학과 가져오기
                  return res.json({
                      success: true,
                      userType: "professor",
                      username: professorName, // 교수 이름을 username에 할당
                      userdepartment: department,
                      message: "교수 로그인 성공"
                  });
              } else {
                  // 로그인 실패 (학생도 교수도 아님)
                  return res.json({ success: false, message: "아이디 또는 비밀번호가 틀렸습니다" });
              }
          });
      }
  });
});

//학생 수강신청 페이지 과목 조회
web.get('/main', (req, res) => {
  const query = `
    SELECT 
      c.COURSE_CODE, c.COURSE_NAME, c.CAMPUS, c.MAJOR_CATEGORY, c.FACULTY, 
      c.DEPARTMENT, c.YEAR_GRADE, c.CLASS_SECTION, c.P_ID_C, 
      c.MAX_STUDENTS, c.DAY_OF_WEEK, c.S_TIME, c.E_TIME,
      p.NAME AS PROFESSOR_NAME 
    FROM hanseo.course c 
    LEFT JOIN hanseo.professor p ON c.P_ID_C = p.P_ID
    WHERE c.OPEN_STATUS = '개설'
`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ DB 쿼리 오류:", err);
      return res.status(500).send("서버 오류 발생");
    }

    console.log("✅ 조회된 과목 데이터:", results); // 데이터 확인용 출력

    res.render('main', { courseList: results }); // EJS에 넘겨줌
  });
});

//교수용 메인: 강의 목록만 간단히 조회
web.get('/pmain', (req, res) => {
  const sql = "SELECT COURSE_NAME, COURSE_CODE FROM course";
  db.query(sql, (err, results) => {
      if (err) throw err;
      res.render("pmain", { courses: results }); // EJS 렌더링
  });
});

//교수용이면 본인만, 아니면 전체 조회
web.get('/courses', (req, res) => {
  const userType = req.query.userType;
  const professorId = req.query.professorId;

  let sql;
  let values = [];

  if (userType === 'professor') {
    // 교수일 경우, 해당 교수의 강의만 반환
    sql = 'SELECT COURSE_NAME, COURSE_CODE, CLASS_SECTION FROM course WHERE P_ID_C = ?';
    values = [professorId];
  } else {
    // 학생일 경우, 모든 강의를 반환 (필요에 따라 수정)
    sql = 'SELECT COURSE_NAME, COURSE_CODE FROM course';
  }

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error('강의 조회 중 오류 발생:', err);
      return res.status(500).json({ success: false, message: '강의 정보를 불러오는 중 오류 발생' });
    }

    res.json({ success: true, courses: results }); // JSON 반환
  });
});

//교수 사이트: 강의를 신청한 학생 불러오기
web.get('/manage-attendance', (req, res) => {
  let { courseCode, section, professorId } = req.query;

  console.log('요청받은 courseCode:', courseCode);
  console.log('요청받은 section:', section);
  console.log('요청받은 professorId:', professorId);

  if (!courseCode || !section || !professorId) {
    return res.status(400).json({ success: false, message: '강의 코드, 분반, 교수 아이디가 필요합니다.' });
  }

  // courseCode에서 '-' 앞부분만 사용
  courseCode = courseCode.split('-')[0];
  console.log('변경된 courseCode:', courseCode);

  // 1단계: 학생 정보 조회
const studentSql = `
  SELECT s.S_ID, s.NAME, s.YEAR_GRADE, s.DEPARTMENT,
         CASE 
           WHEN EXISTS (
             SELECT 1 FROM achievement a
             JOIN course c2 ON a.COURSE_ID_ACH = c2.ID
             WHERE a.S_ID_ACH = s.S_ID 
               AND c2.COURSE_CODE = c.COURSE_CODE 
               AND a.TOT < 70
           ) THEN 1 ELSE 0
         END AS IS_RETAKE
  FROM student s
  JOIN c_r cr ON s.S_ID = cr.S_ID_CR  
  JOIN course c ON cr.COURSE_ID_CR = c.ID
  WHERE c.COURSE_CODE = ? 
    AND c.CLASS_SECTION = ? 
    AND cr.STATUS = '신청';
`;

  db.query(studentSql, [courseCode, section], (err, studentResults) => {
    if (err) {
      console.error('학생 정보 조회 중 오류:', err);
      return res.status(500).json({ success: false, message: '학생 정보를 불러오는 중 오류 발생' });
    }

    console.log('학생 목록:', studentResults);

    // 2단계: 과목의 시간표(schedule) 조회
    const courseSql = `
      SELECT DAY_OF_WEEK, S_TIME, E_TIME
      FROM course
      WHERE COURSE_CODE = ? AND CLASS_SECTION = ? AND P_ID_C = ?
    `;

    db.query(courseSql, [courseCode, section, professorId], (err, courseResults) => {
      if (err) {
        console.error('과목 정보 조회 오류:', err);
        return res.status(500).json({ success: false, message: '과목 정보 조회 실패' });
      }

      if (courseResults.length === 0) {
        console.warn('해당 과목 없음 또는 교수 미일치');
        return res.status(404).json({ success: false, message: '해당 과목 정보를 찾을 수 없습니다.' });
      }

      const { DAY_OF_WEEK, S_TIME, E_TIME } = courseResults[0];
      const dayArray = DAY_OF_WEEK.split(',');
      const sTimeArr = JSON.parse(S_TIME);
      const eTimeArr = JSON.parse(E_TIME);

      const schedule = {};
      dayArray.forEach((day, i) => {
        const dayIndex = "일월화수목금토".indexOf(day);
        schedule[dayIndex] = Array.from({ length: eTimeArr[i] - sTimeArr[i] + 1 }, (_, j) => sTimeArr[i] + j);
      });

      return res.json({
        success: true,
        students: studentResults,
        schedule,
        attendanceData: [] // 출석 데이터는 이후에 필요 시 추가
      });
    });
  });
});

//출석 저장 api : 여러 학생의 출석 정보 한번에 저장(중복시 update)
web.post("/save-attendance", (req, res) => {
  const { courseId, attendanceData, professorId, attendanceDate, period } = req.body;

  if (!attendanceData || attendanceData.length === 0) {
    return res.status(400).json({ success: false, message: "출결 데이터가 없습니다." });
  }

  const values = attendanceData.map(({ S_ID, status }) => [
    S_ID,
    courseId,
    professorId,
    attendanceDate,
    status,
    period
  ]);

  const sql = `
    INSERT INTO attendance (S_ID_ATT, COURSE_ID_ATT, P_ID_ATT, ATT_TIME, status, PERIOD)
    VALUES ? 
    ON DUPLICATE KEY UPDATE 
      status = VALUES(status),
      ATT_TIME = VALUES(ATT_TIME),
      PERIOD = VALUES(PERIOD)
  `;

  db.query(sql, [values], (err) => {
    if (err) {
      console.error("출결 저장 오류:", err);
      return res.status(500).json({ success: false, message: "출결 데이터를 저장하는 중 오류 발생" });
    }
    res.json({ success: true });
  });
});

//course_code로 강의 Id를 조회하는 API 추가(출결저장용)
web.get("/get-course-id", (req, res) => {
  const { courseCode } = req.query;

  if (!courseCode) {
      return res.status(400).json({ success: false, message: "courseCode가 없습니다." });
  }

  const sql = "SELECT ID FROM course WHERE course_code = ?";
  db.query(sql, [courseCode], (err, results) => {
      if (err) {
          console.error("강의 ID 조회 오류:", err);
          return res.status(500).json({ success: false, message: "강의 ID 조회 중 오류 발생" });
      }

      if (results.length === 0) {
          return res.status(404).json({ success: false, message: "강의 정보를 찾을 수 없습니다." });
      }

      res.json({ success: true, courseId: results[0].ID });
  });
});

//강의 추가 api : 요일과 교시 정보 포함하여 새 강의 추가
web.post('/api/course/add', (req, res) => {
  const {
    courseCode, courseName, campus, educationType, faculty, department, 
    year, section, professorID, maxStudents, days, schedule
  } = req.body;

  // 요일별로 시작시간과 종료시간을 배열로 분리
  let s_time = [];
  let e_time = [];

  ['월', '화', '수', '목', '금'].forEach(day => {
    const startPeriod = schedule[day]?.startPeriod;
    const endPeriod = schedule[day]?.endPeriod;
    if (startPeriod && endPeriod) {
      s_time.push(startPeriod);  // 시작 시간 배열에 추가
      e_time.push(endPeriod);    // 종료 시간 배열에 추가
    }
  });

  const query = `INSERT INTO course (
    COURSE_CODE, COURSE_NAME, CAMPUS, MAJOR_CATEGORY, FACULTY, DEPARTMENT, 
    YEAR_GRADE, CLASS_SECTION, P_ID_C, MAX_STUDENTS, DAY_OF_WEEK, S_TIME, E_TIME
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    courseCode, courseName, campus, educationType, faculty, department, 
    year, section, professorID, maxStudents, days, JSON.stringify(s_time), JSON.stringify(e_time)
  ];

  db.execute(query, values, (err) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Database error');
    }
    res.status(200).send('Course added successfully');
  });
});

//수강 상태 조회 api; 학생 id 기반으로 신청한 과목 코드와 상태 조회 
web.get('/enrollments', (req, res) => {
  const studentId = req.query.studentId;  // 클라이언트로부터 학생 ID 받기

  console.log("📌 요청받은 studentId:", studentId);  // ✅ 로그로 확인

  if (!studentId) {
    return res.status(400).json({ success: false, message: '학생 ID가 필요합니다.' });
  }

  const query = `
    SELECT course.COURSE_CODE, course.CLASS_SECTION, c_r.STATUS
    FROM c_r
    JOIN course ON course.ID = c_r.COURSE_ID_CR
    WHERE c_r.S_ID_CR = ?  -- 로그인한 학생에 해당하는 수강신청 상태만 반환
  `;

  db.query(query, [studentId], (err, result) => {
    if (err) {
      console.error("❌ DB 오류:", err);
      return res.status(500).json({ success: false, message: "데이터베이스 오류가 발생했습니다." });
    }

    console.log("📌 받은 studentId:", studentId);  // studentId 값 확인
    console.log("✅ 조회된 데이터:", result);      // 쿼리 결과 확인
    
    if (result.length === 0) {
      console.log("❌ 조회된 데이터가 없습니다.");  // 데이터가 없을 경우
    }

    res.json({
      success: true,
      enrollments: result  // 로그인한 사용자의 수강신청 상태만 반환
    });
  });
});

// 수강 신청 처리, 재수강 로직 추가
// 수강 신청 처리, 재수강 + 시간표 중복 로직 추가
web.post('/enroll', (req, res) => {
    const { studentId, courseCode, section } = req.body;

    if (!studentId) {
        return res.status(400).json({ success: false, message: '학생 ID가 필요합니다.' });
    }

    // 1. 학생 성적 조회 (재수강 가능 여부 확인)
    const gradeCheckQuery = `
      SELECT a.TOT
      FROM achievement a
      JOIN course c ON a.COURSE_ID_ACH = c.ID
      WHERE a.S_ID_ACH = ? AND c.COURSE_CODE = ? AND c.CLASS_SECTION = ?;
    `;

    db.query(gradeCheckQuery, [studentId, courseCode, section], (err, gradeResult) => {
        if (err) {
            console.error("성적 조회 오류:", err);
            return res.json({ success: false, message: "성적 조회 중 오류가 발생했습니다." });
        }

        if (gradeResult.length > 0) {
            const previousScore = gradeResult[0].TOT;
            let previousGrade = '';
            if (previousScore >= 95) previousGrade = 'A+';
            else if (previousScore >= 90) previousGrade = 'A';
            else if (previousScore >= 85) previousGrade = 'B+';
            else if (previousScore >= 80) previousGrade = 'B';
            else if (previousScore >= 75) previousGrade = 'C+';
            else if (previousScore >= 70) previousGrade = 'C';
            else if (previousScore >= 65) previousGrade = 'D+';
            else if (previousScore >= 60) previousGrade = 'D';
            else previousGrade = 'F';

            if (['D+', 'D', 'F'].includes(previousGrade)) {
                console.log(`학생 ${studentId}는 성적 ${previousGrade}(${previousScore}점)으로 재수강 가능합니다.`);
                continueEnrollmentProcess();
            } else {
                return res.json({ success: false, message: `성적 ${previousGrade}(${previousScore}점)를 취득하여 재수강할 수 없습니다.` });
            }
        } else {
            console.log(`학생 ${studentId}의 과거 수강 기록이 없어 바로 신청을 진행합니다.`);
            continueEnrollmentProcess();
        }
    });

    // 2. 실제 수강신청 로직
    function continueEnrollmentProcess() {
        const courseInfoQuery = `
            SELECT ID, MAX_STUDENTS, DAY_OF_WEEK, S_TIME, E_TIME
            FROM course
            WHERE COURSE_CODE = ? AND CLASS_SECTION = ?;
        `;

        db.query(courseInfoQuery, [courseCode, section], (err, courseResult) => {
            if (err || courseResult.length === 0) {
                console.error("과목 정보 조회 오류:", err);
                return res.json({ success: false, message: "과목 정보를 찾을 수 없습니다." });
            }

            const courseId = courseResult[0].ID;
            const maxStudents = courseResult[0].MAX_STUDENTS;
            const newDays = courseResult[0].DAY_OF_WEEK.split(",");
            const newStart = JSON.parse(courseResult[0].S_TIME);
            const newEnd   = JSON.parse(courseResult[0].E_TIME);

            // ✅ 2-1. 시간표 중복 확인
            const conflictQuery = `
              SELECT c.COURSE_NAME, c.DAY_OF_WEEK, c.S_TIME, c.E_TIME
              FROM c_r cr
              JOIN course c ON cr.COURSE_ID_CR = c.ID
              WHERE cr.S_ID_CR = ? AND cr.STATUS = '신청'
            `;
            db.query(conflictQuery, [studentId], (err, enrolledCourses) => {
                if (err) {
                    console.error("시간표 조회 오류:", err);
                    return res.json({ success: false, message: "시간표 확인 중 오류 발생" });
                }

                let conflict = false;
                enrolledCourses.forEach(enrolled => {
                    const existStart = JSON.parse(enrolled.S_TIME);
                    const existEnd   = JSON.parse(enrolled.E_TIME);
                    const existDays  = enrolled.DAY_OF_WEEK.split(",");

                    existDays.forEach((day, i) => {
                        if (newDays.includes(day)) {
                            // 교시 범위가 겹치면 충돌
                            if (!(newEnd[0] < existStart[i] || newStart[0] > existEnd[i])) {
                                conflict = true;
                            }
                        }
                    });
                });

                if (conflict) {
                    return res.json({ success: false, message: "이미 신청한 강의와 시간이 겹칩니다." });
                }

                // ✅ 3. 현재 신청 인원 수 조회
                const countQuery = `
                    SELECT COUNT(*) AS currentCount FROM c_r
                    WHERE COURSE_ID_CR = ? AND STATUS = '신청';
                `;
                db.query(countQuery, [courseId], (err, countResult) => {
                    if (err) {
                        console.error("신청 인원 조회 오류:", err);
                        return res.json({ success: false, message: "신청 인원 조회 오류" });
                    }

                    const currentCount = countResult[0].currentCount;

                    if (currentCount >= maxStudents) {
                        return res.json({ success: false, message: "신청 인원이 가득 찼습니다." });
                    }

                    // ✅ 4. 이미 신청/취소 여부 확인
                    const checkQuery = `
                        SELECT STATUS FROM c_r 
                        WHERE S_ID_CR = ? AND COURSE_ID_CR = ?;
                    `;
                    db.query(checkQuery, [studentId, courseId], (err, result) => {
                        if (err) {
                            console.error("DB 오류:", err);
                            return res.json({ success: false, message: "DB 오류" });
                        }

                        if (result.length > 0) {
                            if (result[0].STATUS === '취소') {
                                const updateQuery = `
                                    UPDATE c_r SET STATUS = '신청'
                                    WHERE S_ID_CR = ? AND COURSE_ID_CR = ?;
                                `;
                                db.query(updateQuery, [studentId, courseId], (err) => {
                                    if (err) {
                                        console.error("업데이트 오류:", err);
                                        return res.json({ success: false, message: "DB 오류" });
                                    }
                                    return res.json({ success: true });
                                });
                            } else {
                                return res.json({ success: false, message: "이미 수강신청이 되어있습니다." });
                            }
                        } else {
                            const insertQuery = `
                                INSERT INTO c_r (S_ID_CR, COURSE_ID_CR, STATUS)
                                VALUES (?, ?, '신청');
                            `;
                            db.query(insertQuery, [studentId, courseId], (err) => {
                                if (err) {
                                    console.error("삽입 오류:", err);
                                    return res.json({ success: false, message: "DB 오류" });
                                }
                                return res.json({ success: true });
                            });
                        }
                    });
                });
            });
        });
    }
});

// 수강 취소 처리, 신청된 과목을 취소로 변경함
web.post("/cancel-enroll", (req, res) => {
  const { studentId, courseCode, section } = req.body;

  const query = `
      UPDATE c_r 
      SET STATUS = '취소' 
      WHERE S_ID_CR = ? 
      AND COURSE_ID_CR = (SELECT ID FROM course WHERE COURSE_CODE = ? AND CLASS_SECTION = ?);
  `;

  db.query(query, [studentId, courseCode, section], (err, result) => {
      if (err) {
          console.error("DB 오류:", err);
          return res.json({ success: false, message: "DB 오류" });
      }
      res.json({ success: true });
  });
});

//장바구니 기능 구현(희망 과목 추가)
web.post('/wishlist/add', (req, res) => {
  const { studentId, courseCode, section } = req.body;

  const insertQuery = `
    INSERT INTO basket (S_ID_BK, COURSE_ID_BK, PRIORITY)
    VALUES (?, (SELECT ID FROM course WHERE COURSE_CODE = ? AND CLASS_SECTION = ?), '희망')
    ON DUPLICATE KEY UPDATE PRIORITY = '희망';
  `;

  db.query(insertQuery, [studentId, courseCode, section], (err, result) => {
    if (err) {
      console.error("DB 오류:", err);
      return res.status(500).json({ success: false, message: "DB 오류" });
    }
    res.json({ success: true });
  });
});

//희망 과목 삭제
web.post('/wishlist/remove', (req, res) => {
  const { studentId, courseCode, section } = req.body;

  const deleteQuery = `
    DELETE FROM basket 
    WHERE S_ID_BK = ? AND COURSE_ID_BK = (
      SELECT ID FROM course WHERE COURSE_CODE = ? AND CLASS_SECTION = ?
    )
  `;

  db.query(deleteQuery, [studentId, courseCode, section], (err, result) => {
    if (err) {
      console.error("DB 오류:", err);
      return res.status(500).json({ success: false, message: "DB 오류" });
    }
    res.json({ success: true });
  });
});

//현재 학생의 희망 과목 목록 반환
web.get('/wishlist', (req, res) => {
  const studentId = req.query.studentId;

  const query = `
    SELECT course.COURSE_CODE, course.CLASS_SECTION
    FROM basket
    JOIN course ON basket.COURSE_ID_BK = course.ID
    WHERE basket.S_ID_BK = ? AND basket.PRIORITY = '희망'
  `;

  db.query(query, [studentId], (err, result) => {
    if (err) {
      console.error("DB 오류:", err);
      return res.status(500).json({ success: false, message: "DB 오류" });
    }
    res.json({ success: true, wishlist: result });
  });
});

// web.js 파일의 마지막 부분에 추가

web.get('/wishlist-courses', (req, res) => {
    const studentId = req.query.studentId;

    const query = `
        SELECT 
            c.COURSE_CODE, c.COURSE_NAME, c.MAJOR_CATEGORY, c.YEAR_GRADE, 
            c.CLASS_SECTION, c.DAY_OF_WEEK, c.S_TIME, c.E_TIME, c.CAMPUS,
            p.NAME AS PROFESSOR_NAME
        FROM basket b
        JOIN course c ON b.COURSE_ID_BK = c.ID
        JOIN professor p ON c.P_ID_C = p.P_ID
        WHERE b.S_ID_BK = ? AND b.PRIORITY = '희망'
    `;

    db.query(query, [studentId], (err, results) => {
        if (err) {
            console.error("❌ 희망 과목 상세 조회 오류:", err);
            return res.status(500).json({ success: false, message: "DB 오류" });
        }
        res.json({ success: true, courses: results });
    });
});

//교수용 성적 저장 처리, 기존 성적이 있으면 update, 없으면 insert
web.post('/submit-achievement', async (req, res) => {
  const grades = req.body.grades;

  try {
    for (let g of grades) {
      db.query(
        'SELECT ID FROM course WHERE COURSE_CODE = ? AND CLASS_SECTION = ?',
        [g.courseCode, g.section],
        (err, courseRow) => {
          if (err) return console.error(err);
          if (courseRow.length === 0) return;

          const courseId = courseRow[0].ID;

          // -------------------------------
          // 1. 학점 계산
          // -------------------------------
          let grade = 'F';
          if (g.att === 0) {
            grade = 'F';
          } else {
            const total = g.total;
            if (total >= 95) grade = 'A+';
            else if (total >= 90) grade = 'A';
            else if (total >= 85) grade = 'B+';
            else if (total >= 80) grade = 'B';
            else if (total >= 75) grade = 'C+';
            else if (total >= 70) grade = 'C';
            else if (total >= 65) grade = 'D+';
            else if (total >= 60) grade = 'D';
            else grade = 'F';
          }

          // -------------------------------
          // 2. 재수강 여부 확인 → A+ 제한
          // -------------------------------
          const retakeSql = `
            SELECT 1
            FROM achievement a
            JOIN course c2 ON a.COURSE_ID_ACH = c2.ID
            WHERE a.S_ID_ACH = ?
              AND c2.COURSE_CODE = ?
              AND a.TOT < 70
            LIMIT 1
          `;

          db.query(retakeSql, [g.studentId, g.courseCode], (err, retakeRows) => {
            if (!err && retakeRows.length > 0 && grade === 'A+') {
              grade = 'A'; // 재수강이면 A+ → A로 제한
            }

            // -------------------------------
            // 3. 기존 성적 존재 여부 확인 후 UPDATE/INSERT
            // -------------------------------
            db.query(
              `SELECT * FROM achievement WHERE COURSE_ID_ACH = ? AND S_ID_ACH = ? AND P_ID_ACH = ?`,
              [courseId, g.studentId, g.professorId],
              (err, exist) => {
                if (err) return console.error(err);

                if (exist.length > 0) {
                  // UPDATE
                  db.query(
                    `UPDATE achievement 
                     SET ATT = ?, MIDTERM = ?, FINAL = ?, ASSIGNMENT = ?, TOT = ?, GRADE = ? 
                     WHERE COURSE_ID_ACH = ? AND S_ID_ACH = ? AND P_ID_ACH = ?`,
                    [g.att, g.midterm, g.finalExam, g.assignment, g.total, grade, courseId, g.studentId, g.professorId],
                    (err) => { if (err) console.error(err); }
                  );
                } else {
                  // INSERT
                  db.query(
                    `INSERT INTO achievement 
                     (ATT, MIDTERM, FINAL, ASSIGNMENT, TOT, GRADE, COURSE_ID_ACH, S_ID_ACH, P_ID_ACH)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [g.att, g.midterm, g.finalExam, g.assignment, g.total, grade, courseId, g.studentId, g.professorId],
                    (err) => { if (err) console.error(err); }
                  );
                }
              }
            );
          });
        }
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

//성적 조회
// 성적 조회: courseCode, section, professorId 기준으로 성적 + 학생정보 반환
web.get('/prof/grades', (req, res) => {
  const { courseCode, section, professorId } = req.query;
  if (!courseCode || !section || !professorId) {
    return res.status(400).json({ success:false, message:'courseCode, section, professorId 필요' });
  }

  const findCourseSql = `
    SELECT ID AS COURSE_ID
    FROM course
    WHERE COURSE_CODE = ? AND CLASS_SECTION = ? AND P_ID_C = ?
    LIMIT 1
  `;
  db.query(findCourseSql, [courseCode, section, professorId], (err, courseRows) => {
    if (err) {
      console.error('과목 조회 오류:', err);
      return res.status(500).json({ success:false, message:'과목 조회 실패' });
    }
    if (courseRows.length === 0) {
      return res.json({ success:true, grades: [] }); // 과목이 없으면 빈 배열
    }

    const courseId = courseRows[0].COURSE_ID;

    const sql = `
      SELECT 
        s.S_ID           AS STUDENT_ID,
        s.NAME           AS STUDENT_NAME,
        s.DEPARTMENT,
        s.YEAR_GRADE,
        a.ATT, a.ASSIGNMENT, a.MIDTERM, a.FINAL, a.TOT, a.GRADE
      FROM c_r cr
      JOIN student s         ON s.S_ID = cr.S_ID_CR
      LEFT JOIN achievement a ON a.S_ID_ACH = s.S_ID 
                              AND a.COURSE_ID_ACH = ?
                              AND a.P_ID_ACH = ?
      WHERE cr.COURSE_ID_CR = ?
        AND cr.STATUS = '신청'
      ORDER BY s.NAME
    `;
    db.query(sql, [courseId, professorId, courseId], (err2, rows) => {
      if (err2) {
        console.error('성적 조회 오류:', err2);
        return res.status(500).json({ success:false, message:'성적 조회 실패' });
      }
      res.json({ success:true, grades: rows });
    });
  });
});

// 학생의 과거 성적을 포함한 전체 과목 목록 조회
// studentId를 쿼리 파라미터로 받아 해당 학생의 성적 정보를 함께 반환합니다.
web.get('/all-courses', (req, res) => {
  const studentId = req.query.studentId;

  const query = `
    SELECT 
      c.COURSE_CODE, c.COURSE_NAME, c.CAMPUS, c.MAJOR_CATEGORY, c.FACULTY, 
      c.DEPARTMENT, c.YEAR_GRADE, c.CLASS_SECTION, c.P_ID_C, 
      c.MAX_STUDENTS, c.DAY_OF_WEEK, c.S_TIME, c.E_TIME,
      p.NAME AS PROFESSOR_NAME,
      a.TOT AS PREVIOUS_SCORE
    FROM hanseo.course c 
    LEFT JOIN hanseo.professor p ON c.P_ID_C = p.P_ID
    LEFT JOIN hanseo.achievement a ON c.ID = a.COURSE_ID_ACH AND a.S_ID_ACH = ?
    WHERE c.OPEN_STATUS = '개설'
  `;

  db.query(query, [studentId], (err, results) => {
    if (err) {
      console.error("❌ DB 쿼리 오류:", err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true, courses: results });
  });
});

// 재수강 과목 조회 (TOT 점수 기준: 70점 미만 → D+ 이하)
web.get('/retake-courses', (req, res) => {
  const studentId = req.query.studentId;

  if (!studentId) {
    return res.status(400).json({ success: false, message: '학생 ID가 필요합니다.' });
  }

  const sql = `
    SELECT DISTINCT 
      c.COURSE_CODE, c.COURSE_NAME, c.CAMPUS, c.MAJOR_CATEGORY, 
      c.FACULTY, c.DEPARTMENT, c.YEAR_GRADE, c.CLASS_SECTION, 
      c.P_ID_C, c.MAX_STUDENTS, c.DAY_OF_WEEK, c.S_TIME, c.E_TIME,
      p.NAME AS PROFESSOR_NAME,
      a.TOT AS PREVIOUS_SCORE
    FROM course c
    JOIN achievement a ON a.COURSE_ID_ACH = c.ID
    JOIN professor p ON c.P_ID_C = p.P_ID
    WHERE a.S_ID_ACH = ?
      AND a.TOT < 70           -- 총점 70 미만이면 재수강 가능
      AND c.OPEN_STATUS = '개설';
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("재수강 과목 조회 오류:", err);
      return res.status(500).json({ success: false, message: "DB 오류" });
    }
    res.json({ success: true, courses: results });
  });
});



// 드롭다운 항목 불러오기 (학과, 전공, 학년)
web.get('/dropdown-options', (req, res) => {
  const sql = `
    SELECT DISTINCT MAJOR_CATEGORY, DEPARTMENT, YEAR_GRADE
    FROM course
    WHERE OPEN_STATUS = '개설'
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("드롭다운 옵션 조회 오류:", err);
      return res.status(500).json({ success: false });
    }

    const majors = [...new Set(results.map(r => r.MAJOR_CATEGORY))].sort();
    const departments = [...new Set(results.map(r => r.DEPARTMENT))].sort();
    const years = [...new Set(results.map(r => r.YEAR_GRADE))].sort();

    res.json({ success: true, majors, departments, years });
  });
});

//키워드 조회(과목코드 또는 이름)
web.get('/search-courses', (req, res) => {
  const keyword = `%${req.query.keyword}%`;

  const sql = `
    SELECT 
      c.COURSE_CODE, c.COURSE_NAME, c.CAMPUS, c.MAJOR_CATEGORY, c.FACULTY, 
      c.DEPARTMENT, c.YEAR_GRADE, c.CLASS_SECTION, c.P_ID_C, 
      c.MAX_STUDENTS, c.DAY_OF_WEEK, c.S_TIME, c.E_TIME,
      p.NAME AS PROFESSOR_NAME 
    FROM hanseo.course c 
    LEFT JOIN hanseo.professor p ON c.P_ID_C = p.P_ID
    WHERE c.OPEN_STATUS = '개설'
      AND (c.COURSE_NAME LIKE ? OR c.COURSE_CODE LIKE ?)
  `;

  db.query(sql, [keyword, keyword], (err, results) => {
    if (err) {
      console.error("검색 쿼리 오류:", err);
      return res.status(500).json({ success: false, message: 'DB 오류' });
    }

    res.json({ success: true, courses: results });
  });
});


//출석부 데이터 불러오기: 개강일부터 종강일 까지 강의 요일에 맞는 날짜 생성
//해당 학생들의 출석 데이터를 날짜별로 정리하여 반환
web.get('/rollbook-data', (req, res) => {
  const { courseCode, section } = req.query;

  const getCourseInfoSql = `
    SELECT ID, DAY_OF_WEEK FROM course WHERE COURSE_CODE = ? AND CLASS_SECTION = ?
  `;

  db.query(getCourseInfoSql, [courseCode, section], (err, courseResult) => {
    if (err || courseResult.length === 0) {
      console.error('강의 정보 조회 오류:', err);
      return res.status(500).json({ success: false });
    }

    const courseId = courseResult[0].ID;
    const days = courseResult[0].DAY_OF_WEEK;

    const weekdays = days.split(',').map(day => "일월화수목금토".indexOf(day));
    const startDate = new Date("2025-03-03");//개강일
    const endDate = new Date("2025-06-23");//종강일일

    const dateList = [];
    let current = new Date(startDate);
    while (current <= endDate) {  // << 여기서 조건 수정
      if (weekdays.includes(current.getDay())) {
        dateList.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    
    const sql = `
      SELECT s.S_ID, s.NAME, s.DEPARTMENT,
             DATE_FORMAT(a.ATT_TIME, '%Y-%m-%d') AS ATT_DATE, a.STATUS
      FROM student s
      JOIN c_r cr ON s.S_ID = cr.S_ID_CR
      LEFT JOIN attendance a ON s.S_ID = a.S_ID_ATT AND a.COURSE_ID_ATT = ?
      WHERE cr.COURSE_ID_CR = ? AND cr.STATUS = '신청'
    `;

    db.query(sql, [courseId, courseId], (err, rows) => {
      if (err) {
        console.error("출석 데이터 조회 오류:", err);
        return res.status(500).json({ success: false });
      }

      const students = {};
      rows.forEach(row => {
        if (!students[row.S_ID]) {
          students[row.S_ID] = {
            NAME: row.NAME,
            S_ID: row.S_ID,
            DEPARTMENT: row.DEPARTMENT,
            attendance: Object.fromEntries(dateList.map(date => [date, '-']))
          };
        }

        if (row.ATT_DATE && students[row.S_ID].attendance[row.ATT_DATE] !== undefined) {
          students[row.S_ID].attendance[row.ATT_DATE] = row.STATUS;
        }
      });

      res.json({ success: true, students: Object.values(students) });
    });
  });
});

//요일 정보 불러오기(출석 날짜 계산용): 해당과목의 요일 데이터 반환 
web.get('/get-course-days', (req, res) => {
  const { courseCode, section } = req.query;

  const sql = "SELECT DAY_OF_WEEK FROM course WHERE COURSE_CODE = ? AND CLASS_SECTION = ?";
  db.query(sql, [courseCode, section], (err, results) => {
    if (err || results.length === 0) {
      return res.status(500).json({ success: false, message: "요일 정보 없음" });
    }

    res.json({ success: true, days: results[0].DAY_OF_WEEK }); 
  });
});

//개별 출석 상태 업데이트 api: update시도 -> 없으면 insert -> 있으면 update
web.post('/update-attendance-status', (req, res) => {
  const studentId = req.body.studentId;
  const courseId = req.body.courseId;
  const professorId = req.body.professorId;
  const attendanceDate = req.body.attendanceDate;
  const period = req.body.period;
  const status = req.body.status;

  console.log('[출석 저장 요청]', {
    studentId, courseId, professorId, attendanceDate, period, status
  });

  // PERIOD까지 포함해서 동일한 출석 데이터 있는지 확인
  const updateSql = `
    UPDATE attendance
    SET status = ?
    WHERE S_ID_ATT = ? AND COURSE_ID_ATT = ? AND ATT_TIME = ? AND PERIOD = ?
  `;

  db.query(updateSql, [status, studentId, courseId, attendanceDate, period], (err, result) => {
    if (err) {
      console.error('출석 상태 UPDATE 오류:', err);
      return res.json({ success: false, message: 'update error' });
    }

    if (result.affectedRows === 0) {
      // 기존 출석 데이터 없으면 새로 INSERT
      const insertSql = `
        INSERT INTO attendance (S_ID_ATT, COURSE_ID_ATT, P_ID_ATT, ATT_TIME, STATUS, PERIOD)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.query(insertSql, [studentId, courseId, professorId, attendanceDate, status, period], (err2) => {
        if (err2) {
          console.error('출석 INSERT 오류:', err2);
          return res.json({ success: false, message: 'insert error' });
        }
        return res.json({ success: true, message: 'inserted' });
      });
    } else {
      return res.json({ success: true, message: 'updated' });
    }
  });
});

//해당 날짜의 첫 번째 교시 출석 상태 확인. 일괄출결 사용에 쓰임임
web.get('/get-attendance-status', (req, res) => {
  const { courseId, date, period } = req.query;

  const sql = `
    SELECT S_ID_ATT, STATUS
    FROM attendance
    WHERE COURSE_ID_ATT = ? AND ATT_TIME = ? AND PERIOD = ?
  `;

  db.query(sql, [courseId, date, period], (err, results) => {
    if (err) {
      console.error('1교시 출석 조회 오류:', err);
      return res.json({ success: false });
    }

    const statuses = {};
    results.forEach(row => {
      statuses[row.S_ID_ATT] = row.STATUS;
    });

    res.json({ success: true, statuses });
  });
});

//서버 열어주는 코드
web.listen(port, () => {
    console.log(`서버가 실행되었습니다. 접속 주소: http://localhost:${port}/login`)
})
