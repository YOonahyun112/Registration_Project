// db.js
const mysql = require('mysql2');

require('dotenv').config();

// MySQL 연결 객체 생성
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// 연결 확인
db.connect((err) => {
  if (err) {
    console.error('DB 연결 실패:', err);
    return;
  }
  console.log('MySQL 연결 성공!');
});

module.exports = db; // promise 사용 가능
