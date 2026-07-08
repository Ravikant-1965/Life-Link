import { Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';

import { LandingPage } from './pages/LandingPage/LandingPage';
import { RegisterPage } from './pages/RegisterPage/RegisterPage';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { DashboardPage } from './pages/DashboardPage/DashboardPage';
import { EditProfilePage } from './pages/EditProfilePage/EditProfilePage';
import { EmergencyPage } from './pages/EmergencyPage/EmergencyPage';
import { AccessLogPage } from './pages/AccessLogPage/AccessLogPage';
import { DoctorLoginPage } from './pages/DoctorLoginPage/DoctorLoginPage';
import { DoctorRegisterPage } from './pages/DoctorRegisterPage/DoctorRegisterPage';
import { ForgotPasswordPage } from './pages/LoginPage/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/LoginPage/ResetPasswordPage';

import './App.css';

function readStoredJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (_error) {
        localStorage.removeItem(key);
        return null;
    }
}

function App() {
    const [user, setUser] = useState(() => readStoredJson('lifelink_user'));
    const [token, setToken] = useState(() => localStorage.getItem('lifelink_token'));
    const [doctor, setDoctor] = useState(() => readStoredJson('lifelink_doctor'));
    const [doctorToken, setDoctorToken] = useState(() => localStorage.getItem('lifelink_doctor_token'));

    const login = (userData, tokenData) => {
        setUser(userData);
        setToken(tokenData);
        localStorage.setItem('lifelink_user', JSON.stringify(userData));
        localStorage.setItem('lifelink_token', tokenData);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('lifelink_user');
        localStorage.removeItem('lifelink_token');
    };

    const loginDoctor = (doctorData, tokenData) => {
        setDoctor(doctorData);
        setDoctorToken(tokenData);
        localStorage.setItem('lifelink_doctor', JSON.stringify(doctorData));
        localStorage.setItem('lifelink_doctor_token', tokenData);
    };

    const logoutDoctor = () => {
        setDoctor(null);
        setDoctorToken(null);
        localStorage.removeItem('lifelink_doctor');
        localStorage.removeItem('lifelink_doctor_token');
    };

    return (
        <Routes>
            <Route
                path="/"
                element={
                    <LandingPage
                        user={user}
                        doctor={doctor}
                        logout={logout}
                        logoutDoctor={logoutDoctor}
                    />
                }
            />

            <Route path="register" element={<RegisterPage />} />
            <Route path="login" element={<LoginPage login={login} />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />

            <Route path="doctor/register" element={<DoctorRegisterPage />} />
            <Route path="doctor/login" element={<DoctorLoginPage loginDoctor={loginDoctor} />} />
            <Route
                path="doctor/portal"
                element={
                    <EmergencyPage
                        doctor={doctor}
                        doctorToken={doctorToken}
                        logoutDoctor={logoutDoctor}
                    />
                }
            />
            <Route
                path="emergency"
                element={
                    <EmergencyPage
                        doctor={doctor}
                        doctorToken={doctorToken}
                        logoutDoctor={logoutDoctor}
                    />
                }
            />

            <Route path="dashboard" element={<DashboardPage user={user} token={token} logout={logout} />} />
            <Route path="edit-profile" element={<EditProfilePage user={user} token={token} logout={logout} />} />
            <Route path="access-log" element={<AccessLogPage user={user} token={token} logout={logout} />} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
