import { useState, type FormEvent } from 'react';
import { STORE } from '../data/mock';
import { Icon } from '../components/Icon';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [id, setId] = useState('happy-mart');
  const [pw, setPw] = useState('demo1234');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !pw) {
      setError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    onLogin();
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <span className="brand-mark big">
          <Icon name="sparkle" size={30} />
        </span>
        <h1>마트 AI 운영관리</h1>
        <p className="login-sub">
          재고와 유통기한을 보고,
          <br />
          AI가 추천한 발주만 확인하세요.
        </p>

        <label className="field">
          <span>아이디</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
            inputMode="text"
            autoCapitalize="none"
          />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-primary btn-lg" type="submit">
          로그인
        </button>
        <p className="login-hint">
          체험용 계정이 미리 입력되어 있어요 · {STORE.name}
        </p>
      </form>
    </div>
  );
}
