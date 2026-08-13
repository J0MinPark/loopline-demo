const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3300;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'loopline-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

// 데모용 인메모리 저장소 — 실제 서비스라면 DB를 쓰겠지만, 이 사이트 자체가
// RepliQA QA 대상 데모라 재시작하면 초기화되는 정도로 충분하다.
const users = new Map(); // email -> { name, email, password, verified, plan }
const pendingCodes = new Map(); // email -> { code, expiresAt }

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendVerificationEmail(email, code) {
  const transporter = getTransporter();
  if (!transporter) {
    // SMTP 미설정 시(로컬 개발) 콘솔에 코드를 남겨서 흐름을 그대로 테스트할 수 있게 한다.
    console.log(`[메일 발송 생략 - SMTP 미설정] ${email} 인증 코드: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Loopline <no-reply@loopline.dev>',
    to: email,
    subject: `${code} — Loopline 인증 코드`,
    text: `Loopline 가입을 완료하려면 아래 코드를 입력하세요.\n\n${code}\n\n이 코드는 10분간 유효합니다.`,
  });
}

function requireAuth(req, res, next) {
  if (!req.session.userEmail) return res.redirect('/login');
  next();
}

// ---------- 랜딩 ----------
app.get('/', (req, res) => {
  res.render('index', { user: req.session.userEmail ? users.get(req.session.userEmail) : null });
});

// ---------- 회원가입 (이메일 인증) ----------
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.render('signup', { error: '모든 항목을 입력해 주세요.' });
  }
  if (users.has(email) && users.get(email).verified) {
    return res.render('signup', { error: '이미 가입된 이메일입니다.' });
  }

  users.set(email, { name, email, password, verified: false, plan: 'free' });
  const code = String(crypto.randomInt(100000, 999999));
  pendingCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error('메일 발송 실패:', err.message);
    return res.render('signup', { error: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
  }

  res.redirect(`/verify?email=${encodeURIComponent(email)}`);
});

// ---------- 이메일 인증 코드 확인 ----------
app.get('/verify', (req, res) => {
  const { email } = req.query;
  if (!email || !users.has(email)) return res.redirect('/signup');
  res.render('verify', { email, error: null });
});

app.post('/verify', (req, res) => {
  const { email, code } = req.body;
  const pending = pendingCodes.get(email);
  if (!pending || pending.expiresAt < Date.now()) {
    return res.render('verify', { email, error: '인증 코드가 만료됐습니다. 다시 가입해 주세요.' });
  }
  if (pending.code !== code) {
    return res.render('verify', { email, error: '인증 코드가 올바르지 않습니다.' });
  }

  const user = users.get(email);
  user.verified = true;
  pendingCodes.delete(email);
  req.session.userEmail = email;
  res.redirect('/dashboard');
});

// ---------- 로그인 ----------
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user || !user.verified || user.password !== password) {
    return res.render('login', { error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }
  req.session.userEmail = email;
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- 대시보드 ----------
app.get('/dashboard', requireAuth, (req, res) => {
  const user = users.get(req.session.userEmail);
  res.render('dashboard', { user });
});

// ---------- Pro 플랜 업그레이드(결제 데모) ----------
app.get('/upgrade', requireAuth, (req, res) => {
  const user = users.get(req.session.userEmail);
  res.render('upgrade', { user, error: null });
});

// 실제 결제 게이트웨이 연동이 아니다 — 카드 정보를 받는 척만 하는 순수 데모 폼이며,
// 여기서 무슨 값이 들어와도 진짜 청구는 절대 발생하지 않는다. RepliQA QA 목적상
// "결제하기" 버튼까지 도달하는지 확인하는 게 이 페이지의 유일한 존재 이유다.
app.post('/upgrade', requireAuth, (req, res) => {
  const user = users.get(req.session.userEmail);
  user.plan = 'pro';
  res.render('upgrade-success', { user });
});

app.listen(PORT, () => {
  console.log(`Loopline 데모 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
