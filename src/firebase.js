import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';

// ---------------- Firebase Config ----------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [page, setPage] = useState('auth');
  const [userRole, setUserRole] = useState(null);
  const [isLoginPage, setIsLoginPage] = useState(true);
  const [isAdminAuth, setIsAdminAuth] = useState(false);

  // ---------------- Auth Listener ----------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        const userDocRef = doc(db, `users`, currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const role = userDoc.data().role;
          setUserRole(role);
          setPage(role === 'admin' ? 'admin' : 'voter');
        } else {
          await signOut(auth);
        }
      } else {
        setUserRole(null);
        setPage('auth');
      }
    });

    return () => unsubscribe();
  }, []);

  // ---------------- Handlers ----------------
  const handleLogin = async (e, role) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, `users`, userCredential.user.uid));
      if (!userDoc.exists() || userDoc.data().role !== role) {
        await signOut(auth);
        setAuthError(`Login failed. Not an ${role} account.`);
      }
    } catch (error) {
      setAuthError('Failed to log in. Check your email/password.');
    }
  };

  const handleSignup = async (e, role) => {
    e.preventDefault();
    if (password !== rePassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, `users`, userCredential.user.uid), {
        email: userCredential.user.email,
        role: role,
        createdAt: new Date(),
      });
    } catch (error) {
      setAuthError('Signup failed. Email in use or weak password.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      setAuthError('Logout failed. Try again.');
    }
  };

  // ---------------- UI Pages ----------------
  const renderAuthPage = () => (
    <div className="auth-container">
      <h2>{isLoginPage ? 'Log In' : 'Sign Up'} ({isAdminAuth ? 'Admin' : 'Voter'})</h2>
      {authError && <p className="error">{authError}</p>}

      <div className="switch-role">
        <button onClick={() => setIsAdminAuth(false)}>Voter</button>
        <button onClick={() => setIsAdminAuth(true)}>Admin</button>
      </div>

      <form onSubmit={(e) => isLoginPage ? handleLogin(e, isAdminAuth ? 'admin' : 'voter') : handleSignup(e, isAdminAuth ? 'admin' : 'voter')}>
        <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required />
        {!isLoginPage && (
          <input type="password" placeholder="Re-enter Password" onChange={(e) => setRePassword(e.target.value)} required />
        )}
        <button type="submit">{isLoginPage ? 'Log In' : 'Sign Up'}</button>
      </form>

      <p>
        {isLoginPage ? "Don't have an account?" : "Already have one?"}
        <button onClick={() => setIsLoginPage(!isLoginPage)}>
          {isLoginPage ? 'Sign Up' : 'Log In'}
        </button>
      </p>
    </div>
  );

  const renderAdminPage = () => (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      <p>Welcome {user?.email}</p>
      <button onClick={handleLogout}>Log Out</button>
      <p>📌 Placeholder: Election Management UI will go here.</p>
    </div>
  );

  const renderVoterPage = () => (
    <div className="voter-dashboard">
      <h2>Voter Dashboard</h2>
      <p>Welcome {user?.email}</p>
      <button onClick={handleLogout}>Log Out</button>
      <p>📌 Placeholder: Voter Elections will go here.</p>
    </div>
  );

  if (!isAuthReady) return <p>Loading...</p>;

  return (
    <div className="app-container">
      {page === 'auth' && renderAuthPage()}
      {page === 'admin' && renderAdminPage()}
      {page === 'voter' && renderVoterPage()}
    </div>
  );
}
