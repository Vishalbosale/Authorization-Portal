import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Eye,
    EyeOff,
    IdCard,
    Lock,
    ShieldCheck
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import Captcha from "../../components/Captcha/Captcha";
import {
    generateCaptchaCode,
    normalizeCaptcha
} from "../../utils/captcha";
import axisLogo from "../../assets/axis-dark-logo.svg";
import "./Login.css";


const HIGHLIGHTS = [
    "Multi-level approval routing, end to end",
    "Full audit trail on every request",
    "Authorization letters issued in one place"
];


function Login() {

    const { login } = useAuth();
    const navigate = useNavigate();

    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode());
    const [captchaInput, setCaptchaInput] = useState("");


    // A code is single-use: issue a fresh one after every failed attempt so
    // the same challenge can never be replayed.
    const refreshCaptcha = useCallback(() => {

        setCaptchaCode(generateCaptchaCode());
        setCaptchaInput("");

    }, []);


    const handleSubmit = async (event) => {
        event.preventDefault();

        if (normalizeCaptcha(captchaInput) !== captchaCode) {

            setError("That security code is not correct. Please try the new code.");
            refreshCaptcha();

            return;

        }

        setError("");
        setLoading(true);

        try {
            await login(
                employeeId.trim(),
                password
            );

            navigate("/");

        } catch (error) {
            console.error("Login error:", error);

            setError(
                error.message ||
                "Unable to login."
            );

            refreshCaptcha();

        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">

            <div className="login-shell">

                {/* ---------- Brand panel ---------- */}

                <aside className="login-brand-panel">

                    <div className="login-brand-aurora" aria-hidden="true">
                        <span className="aurora-blob blob-a" />
                        <span className="aurora-blob blob-b" />
                    </div>

                    <div className="login-brand-content">

                        <span className="login-brand-badge">
                            <ShieldCheck size={15} />
                            Secure Access
                        </span>

                        <h2>
                            Authorization
                            <br />
                            Portal
                        </h2>

                        <p>
                            One workspace for raising, reviewing and issuing
                            AL / POA authorizations.
                        </p>

                        <ul className="login-highlights">

                            {HIGHLIGHTS.map((item, index) => (

                                <li
                                    key={item}
                                    style={{ "--i": index }}
                                >
                                    <CheckCircle2 size={16} />
                                    {item}
                                </li>

                            ))}

                        </ul>

                    </div>

                    <span className="login-brand-footnote">
                        Axis Finance Limited · Internal use only
                    </span>

                </aside>


                {/* ---------- Form panel ---------- */}

                <div className="login-card">

                    <img
                        className="login-logo"
                        src={axisLogo}
                        alt="Axis Finance"
                    />

                    <h1>Welcome back</h1>

                    <p className="login-subtitle">
                        Sign in with your employee credentials
                    </p>


                    {error && (
                        <div className="login-error" role="alert">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}


                    <form onSubmit={handleSubmit}>

                        <div className="login-field">

                            <label htmlFor="employeeId">
                                Employee ID
                            </label>

                            <div className="input-shell">

                                <IdCard size={16} className="input-icon" />

                                <input
                                    id="employeeId"
                                    type="text"
                                    value={employeeId}
                                    onChange={(e) =>
                                        setEmployeeId(e.target.value)
                                    }
                                    placeholder="Enter Employee ID"
                                    autoComplete="username"
                                    required
                                />

                            </div>

                        </div>


                        <div className="login-field">

                            <label htmlFor="password">
                                Password
                            </label>

                            <div className="input-shell">

                                <Lock size={16} className="input-icon" />

                                <input
                                    id="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="Enter Password"
                                    autoComplete="current-password"
                                    required
                                />

                                <button
                                    type="button"
                                    className="show-password"
                                    onClick={() =>
                                        setShowPassword(
                                            !showPassword
                                        )
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                >
                                    {showPassword
                                        ? <EyeOff size={16} />
                                        : <Eye size={16} />}
                                </button>

                            </div>

                        </div>


                        <div className="login-field">

                            <label htmlFor="captcha">
                                Security Code
                            </label>

                            <div className="captcha-row">

                                <Captcha
                                    code={captchaCode}
                                    onRefresh={refreshCaptcha}
                                />

                                <div className="input-shell">

                                    <ShieldCheck size={16} className="input-icon" />

                                    <input
                                        id="captcha"
                                        type="text"
                                        value={captchaInput}
                                        onChange={(e) =>
                                            setCaptchaInput(e.target.value)
                                        }
                                        placeholder="Enter the code above"
                                        autoComplete="off"
                                        autoCapitalize="characters"
                                        spellCheck="false"
                                        maxLength={8}
                                        required
                                    />

                                </div>

                            </div>

                        </div>


                        <button
                            type="submit"
                            className="login-submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner" />
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                    </form>


                    <p className="login-help">
                        Trouble signing in? Contact
                        {" "}
                        <a href="mailto:afl.rpa@axisfinance.in">
                            afl.rpa@axisfinance.in
                        </a>
                    </p>

                </div>

            </div>

        </div>
    );
}

export default Login;
