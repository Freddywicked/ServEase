import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
function SignIn() {
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <h1 className="auth-title">Welcome!</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nav("/role-select");
          }}
        >
          <div className="form-field">
            <label>EMAIL ADDRESS</label>
            <input type="email" placeholder="Enter your email" required />
          </div>
          <div className="form-field">
            <label>PASSWORD</label>
            <div className="password-wrap">
              <input
                type={show ? "text" : "password"}
                placeholder="Enter your password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShow(!show)}
                aria-label="Toggle password visibility"
              >
                <FontAwesomeIcon icon={show ? faEyeSlash : faEye} />
              </button>
            </div>
          </div>
          <Link className="forgot-link" to="/forgot-password">
            Forgot password?
          </Link>
          <button className="gradient-button">Sign in</button>
        </form>
        <div className="divider">or</div>
        <button className="google-button">Continue with Google</button>
        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </section>
    </main>
  );
}
export default SignIn;
