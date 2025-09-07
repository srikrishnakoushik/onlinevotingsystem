import React, { useState, useEffect } from 'react';
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
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { Box, Container, Grid, Card, Typography, Avatar, Chip, Stack } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDXBwuwztLdoBPZZTfJuJzW_Q1XkJ90rAQ",
  authDomain: "online-voting-system-a1d0d.firebaseapp.com",
  projectId: "online-voting-system-a1d0d",
  storageBucket: "online-voting-system-a1d0d.firebasestorage.app",
  messagingSenderId: "87488117870",
  appId: "1:87488117870:web:0f1d5d526bd8e13470fa7f",
  measurementId: "G-V2Z7HHZ3ZE"
};

const appId = 'online-voting-system-a1d0d';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Cloudinary Configuration
const CLOUD_NAME = 'dnlo7mv2j';
const UPLOAD_PRESET = 'online_voting_preset';

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
  const [newElectionTitle, setNewElectionTitle] = useState('');
  const [electionError, setElectionError] = useState('');
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [contests, setContests] = useState([]);
  const [newContestTitle, setNewContestTitle] = useState('');
  const [newContestDescription, setNewContestDescription] = useState('');
  const [contestError, setContestError] = useState('');
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionImageUrl, setNewOptionImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [selectedContest, setSelectedContest] = useState(null);
  const [options, setOptions] = useState([]);
  const [voterElections, setVoterElections] = useState([]);
  const [votedOptions, setVotedOptions] = useState({});
  const [results, setResults] = useState({});
  const [voteSuccessMessage, setVoteSuccessMessage] = useState('');

  useEffect(() => {
    let cleanupFunctions = [];

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      cleanupFunctions.forEach(unsub => unsub());
      cleanupFunctions = [];
      setElections([]);
      setVoterElections([]);
      setOptions([]);
      setContests([]);
      setResults({});
      setVotedOptions({});

      if (currentUser) {
        const userDocRef = doc(db, `artifacts/${appId}/users`, currentUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            setUserRole(role);
            
            if (role === 'voter') {
              const electionsCollectionRef = collection(db, `artifacts/${appId}/elections`);
              const liveElectionsQuery = query(electionsCollectionRef, where('status', 'in', ['live', 'closed']));
              const unsubElections = onSnapshot(liveElectionsQuery, (snapshot) => {
                setVoterElections(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
              }, (error) => console.error("Error fetching elections for voter:", error));
              cleanupFunctions.push(unsubElections);
              
              const votesCollectionRef = collection(db, `artifacts/${appId}/votes/${currentUser.uid}/ballots`);
              const unsubVotes = onSnapshot(votesCollectionRef, (snapshot) => {
                const userVotedOptions = {};
                snapshot.docs.forEach(d => userVotedOptions[d.id] = d.data().selection);
                setVotedOptions(userVotedOptions);
              }, (error) => console.error("Error fetching user votes:", error));
              cleanupFunctions.push(unsubVotes);

              setPage('voter-elections');
            } else if (role === 'admin') {
              const electionsCollectionRef = collection(db, `artifacts/${appId}/elections`);
              const unsubElections = onSnapshot(electionsCollectionRef, (snapshot) => {
                setElections(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
              }, (error) => console.error("Error fetching elections for admin:", error));
              cleanupFunctions.push(unsubElections);
              
              setPage('admin');
            }
          } else {
            await signOut(auth);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
        setPage('auth');
      }
    });

    return () => {
      authUnsubscribe();
      cleanupFunctions.forEach(unsub => unsub());
    };
  }, []);

  useEffect(() => {
    if (selectedElection) {
      const contestsCollectionRef = collection(db, `artifacts/${appId}/elections/${selectedElection.id}/contests`);
      const unsubscribe = onSnapshot(contestsCollectionRef, (snapshot) => {
        setContests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsubscribe;
    }
  }, [selectedElection]);

  useEffect(() => {
    if (userRole === 'admin' && selectedElection && selectedContest) {
      const optionsCollectionRef = collection(db, `artifacts/${appId}/elections/${selectedElection.id}/contests/${selectedContest.id}/options`);
      const unsubscribe = onSnapshot(optionsCollectionRef, (snapshot) => {
        setOptions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsubscribe();
    }
  }, [selectedElection, selectedContest, userRole]);

  useEffect(() => {
    if ((page === 'voter-contests' || page === 'results') && selectedElection) {
      const unsubscribeFunctions = [];
      setOptions([]);

      contests.forEach(contest => {
        const optionsCollectionRef = collection(db, `artifacts/${appId}/elections/${selectedElection.id}/contests/${contest.id}/options`);
        const unsubscribeOptions = onSnapshot(optionsCollectionRef, (snapshot) => {
          const optionsList = snapshot.docs.map(d => ({ id: d.id, contestId: contest.id, ...d.data() }));
          setOptions(prevOptions => {
            const otherOptions = prevOptions.filter(o => o.contestId !== contest.id);
            return [...otherOptions, ...optionsList];
          });
        }, (error) => console.error("Error fetching options for voter:", error));
        unsubscribeFunctions.push(unsubscribeOptions);
      });
      
      return () => {
        unsubscribeFunctions.forEach(unsub => unsub());
      };
    }
  }, [page, selectedElection, contests]);

  useEffect(() => {
    if (page === 'results' && selectedElection) {
      const talliesCollectionRef = collection(db, `artifacts/${appId}/tallies/${selectedElection.id}/contests`);
      const unsubscribeTallies = onSnapshot(talliesCollectionRef, (snapshot) => {
        const newResults = {};
        snapshot.docs.forEach(doc => {
          newResults[doc.id] = doc.data().totals || {};
        });
        setResults(newResults);
      }, (error) => console.error("Error fetching results:", error));
      return () => unsubscribeTallies();
    }
  }, [page, selectedElection]);

  const handleLogin = async (e, role) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, `artifacts/${appId}/users`, userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data().role === role) {
        // Correct role, proceed
      } else {
        await signOut(auth);
        setAuthError(`Login failed. This is not an ${role} account.`);
      }
    } catch (error) {
      setAuthError('Failed to log in. Please check your email and password.');
      console.error('Login error:', error);
    }
  };

  const handleSignup = async (e, role) => {
    e.preventDefault();
    if (password !== rePassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      await setDoc(doc(db, `artifacts/${appId}/users`, newUser.uid), {
        email: newUser.email,
        createdAt: new Date(),
        role: role,
      });
      console.log('Account created successfully!');
    } catch (error) {
      setAuthError('Failed to create account. Email may be in use or password is too weak.');
      console.error('Signup error:', error);
    }
  };

  const handleLogout = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError('Failed to log out. Please try again.');
      console.error('Logout error:', error);
    }
  };

  const handleVote = async (contestId, optionId) => {
    setAuthError(null);
    setVoteSuccessMessage('');

    try {
      const userVoteDocRef = doc(db, `artifacts/${appId}/votes/${user.uid}/ballots`, contestId);
      const tallyDocRef = doc(db, `artifacts/${appId}/tallies/${selectedElection.id}/contests`, contestId);

      await runTransaction(db, async (transaction) => {
        const userVoteDoc = await transaction.get(userVoteDocRef);
        if (userVoteDoc.exists()) {
          throw new Error('Already voted in this contest.');
        }

        const tallyDoc = await transaction.get(tallyDocRef);
        const newTotals = tallyDoc.exists() ? tallyDoc.data().totals : {};
        newTotals[optionId] = (newTotals[optionId] || 0) + 1;

        transaction.set(tallyDocRef, { totals: newTotals }, { merge: true });
        transaction.set(userVoteDocRef, {
          selection: optionId,
          votedAt: new Date(),
          electionId: selectedElection.id,
        });
      });
      
      setVotedOptions(prev => ({ ...prev, [contestId]: optionId }));
      setVoteSuccessMessage("Vote has been cast successfully!");
      
    } catch (error) {
      if (error.message === 'Already voted in this contest.') {
        setAuthError('You have already voted in this contest.');
      } else {
        setAuthError('Failed to cast vote. Please try again.');
        console.error('Voting error:', error);
      }
    }
  };


  const handleCreateElection = async (e) => {
    e.preventDefault();
    if (!newElectionTitle) {
      setElectionError('Election title cannot be empty.');
      return;
    }
    setElectionError('');

    try {
      const newElectionRef = doc(collection(db, `artifacts/${appId}/elections`));
      await setDoc(newElectionRef, {
        title: newElectionTitle,
        description: '',
        status: 'draft',
        startAtUTC: null,
        endAtUTC: null,
        createdBy: user.uid,
        createdAt: new Date(),
      });
      setNewElectionTitle('');
    } catch (error) {
      setElectionError('Failed to create election. Please try again.');
      console.error('Create election error:', error);
    }
  };

  const handleDeleteElection = async (electionId) => {
    if (window.confirm("Are you sure you want to delete this election and all of its data? This cannot be undone.")) {
      try {
        const electionDocRef = doc(db, `artifacts/${appId}/elections`, electionId);
        await deleteDoc(electionDocRef);
        // Note: Deleting sub-collections (contests, options, tallies) would require a Cloud Function
        // to avoid a client-side performance bottleneck. For now, the parent document is deleted.
      } catch (error) {
        console.error("Failed to delete election:", error);
      }
    }
  };

  const handleSelectElection = (election) => {
    setSelectedElection(election);
    if (userRole === 'admin') {
      setPage('admin-manage-election');
    } else if (userRole === 'voter') {
      setPage('voter-contests');
    }
  };

  const handleCreateContest = async (e) => {
    e.preventDefault();
    if (!newContestTitle) {
      setContestError('Contest title cannot be empty.');
      return;
    }
    setContestError('');

    try {
      const newContestRef = doc(collection(db, `artifacts/${appId}/elections/${selectedElection.id}/contests`));
      await setDoc(newContestRef, {
        title: newContestTitle,
        description: newContestDescription,
        type: 'single',
        order: contests.length,
        createdAt: new Date(),
      });
      setNewContestTitle('');
      setNewContestDescription('');
    } catch (error) {
      setContestError('Failed to create contest. Please try again.');
      console.error('Create contest error:', error);
    }
  };

  const handleDeleteContest = async (contestId) => {
      if (window.confirm("Are you sure you want to delete this contest?")) {
          try {
            const contestDocRef = doc(db, `artifacts/${appId}/elections/${selectedElection.id}/contests`, contestId);
            await deleteDoc(contestDocRef);
          } catch (error) {
            console.error("Failed to delete contest:", error);
          }
      }
    };

  const handleSelectContest = (contest) => {
    setSelectedContest(contest);
  };

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!newOptionLabel) {
      return;
    }
    try {
      let imageUrl = newOptionImageUrl || 'https://placehold.co/128x128/30363d/8b949e?text=Candidate';

      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', UPLOAD_PRESET);

        const response = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          formData
        );
        imageUrl = response.data.secure_url;
      }
      
      const newOptionRef = doc(collection(db, `artifacts/${appId}/elections/${selectedElection.id}/contests/${selectedContest.id}/options`));
      await setDoc(newOptionRef, {
        label: newOptionLabel,
        order: options.length,
        imageUrl: imageUrl,
        createdAt: new Date(),
      });

      setNewOptionLabel('');
      setNewOptionImageUrl('');
      setImageFile(null);
    } catch (error) {
      console.error("Failed to add option or upload image:", error);
    }
  };

  const handleDeleteOption = async (optionId) => {
    try {
      const optionDocRef = doc(db, `artifacts/${appId}/elections/${selectedElection.id}/contests/${selectedContest.id}/options`, optionId);
      await deleteDoc(optionDocRef);
    } catch (error) {
      console.error("Failed to delete option:", error);
    }
  };

  const handleChangeElectionStatus = async (electionId, newStatus) => {
    try {
      const electionDocRef = doc(db, `artifacts/${appId}/elections`, electionId);
      await updateDoc(electionDocRef, {
        status: newStatus,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to update election status:", error);
    }
  };

  const handleViewResults = (election) => {
    setSelectedElection(election);
    setPage('results');
  };
  
  const handleAdminBackToElections = () => {
    setPage('admin');
    setSelectedElection(null);
    setSelectedContest(null);
  };
  
  const handleVoterBackToElections = () => {
    setPage('voter-elections');
    setSelectedElection(null);
  };

  const renderAuthPage = () => (
    <>
      <p className="description">
        {isLoginPage ? 'Log in as an Admin or Voter to continue.' : 'Sign up to create an Admin or Voter account.'}
      </p>
      {authError && (
        <div className="error-message">
          {authError}
        </div>
      )}
      <div className="form-buttons">
        <button
          className={`secondary-button ${!isAdminAuth ? 'active-button' : ''}`}
          onClick={() => setIsAdminAuth(false)}
        >
          Voter
        </button>
        <button
          className={`secondary-button ${isAdminAuth ? 'active-button' : ''}`}
          onClick={() => setIsAdminAuth(true)}
        >
          Admin
        </button>
      </div>

      {isLoginPage ? (
        <form onSubmit={(e) => handleLogin(e, isAdminAuth ? 'admin' : 'voter')} className="form-container">
          <h2 className="form-heading">{isAdminAuth ? 'Admin Login' : 'Voter Login'}</h2>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="input-field"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input-field"
            required
          />
          <button type="submit" className="primary-button">Log In</button>
        </form>
      ) : (
        <form onSubmit={(e) => handleSignup(e, isAdminAuth ? 'admin' : 'voter')} className="form-container">
          <h2 className="form-heading">{isAdminAuth ? 'Admin Sign Up' : 'Voter Sign Up'}</h2>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="input-field"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input-field"
            required
          />
          <input
            type="password"
            value={rePassword}
            onChange={(e) => setRePassword(e.target.value)}
            placeholder="Re-enter Password"
            className="input-field"
            required
          />
          <button type="submit" className="primary-button">Sign Up</button>
        </form>
      )}

      <div className="flex-center mt-4">
        <span className="description-text">
          {isLoginPage ? "Don't have an account?" : "Already have an account?"}
        </span>
        <button
          onClick={() => {
            setIsLoginPage(!isLoginPage);
            setAuthError(null);
          }}
          className="link-button"
        >
          {isLoginPage ? 'Sign Up' : 'Log In'}
        </button>
      </div>
    </>
  );

  const renderVoterElectionsPage = () => (
    <div className="page-content-container">
      <h2 className="page-heading">My Elections</h2>
      <p className="description">
        Select an election to cast your vote.
      </p>
      <div className="elections-list">
        {voterElections.length === 0 ? (
          <p className="description-text">No elections available yet.</p>
        ) : (
          <ul className="list-container">
            {voterElections.map(election => (
              <li key={election.id} className="election-card">
                <div className="list-item-content">
                  <span className="election-title">{election.title}</span>
                  <span className="election-status">{election.status}</span>
                  <div className="list-item-actions">
                    {election.status === 'live' && (
                      <button className="secondary-button" onClick={() => handleSelectElection(election)}>Vote</button>
                    )}
                    {election.status === 'closed' && (
                      <button className="secondary-button" onClick={() => handleViewResults(election)}>Results</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const renderVoterContestPage = () => (
    <div className="page-content-container">
      <h2 className="page-heading">Cast Your Vote: {selectedElection.title}</h2>
      <p className="description">Select your choices for each contest.</p>
      <button className="secondary-button back-button" onClick={handleVoterBackToElections}>
        &larr; Back to Elections
      </button>
      {authError && (
        <div className="error-message">
          {authError}
        </div>
      )}
      {voteSuccessMessage && (
        <div className="success-message">
          {voteSuccessMessage}
        </div>
      )}
      {contests.length === 0 ? (
        <p className="description-text">No contests found for this election.</p>
      ) : (
        <ul className="list-container">
          {contests.map(contest => (
            <li key={contest.id} className="contest-card-expanded">
              <h3 className="contest-title">{contest.title}</h3>
              <p className="description">{contest.description}</p>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                {options.filter(o => o.contestId === contest.id).map(option => (
                  <Grid item xs={12} sm={6} key={option.id}>
                    <Card
                      sx={{
                        backgroundColor: '#1a1e23',
                        color: '#e6e6e6',
                        border: '1px solid #30363d',
                        borderRadius: '0.75rem',
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        cursor: votedOptions[contest.id] !== undefined ? 'default' : 'pointer',
                        transition: 'transform 0.2s ease-in-out',
                        '&:hover': {
                           transform: votedOptions[contest.id] !== undefined ? 'none' : 'scale(1.02)'
                        }
                      }}
                      onClick={() => votedOptions[contest.id] === undefined && handleVote(contest.id, option.id)}
                    >
                      <Avatar
                        src={option.imageUrl}
                        alt={option.label}
                        sx={{ width: 80, height: 80 }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                        {option.label}
                      </Typography>
                      <button
                        className="primary-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(contest.id, option.id);
                        }}
                        disabled={votedOptions[contest.id] !== undefined}
                        style={{ width: '100%' }}
                      >
                        {votedOptions[contest.id] === option.id ? 'Voted' : 'Select'}
                      </button>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderResultsPage = () => {
    if (!selectedElection) return null;

    const findWinner = (contestId) => {
      const contestResults = results[contestId];
      if (!contestResults) return [];

      let winner = [];
      let maxVotes = 0;

      for (const optionId in contestResults) {
        const voteCount = contestResults[optionId];
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winner = [optionId];
        } else if (voteCount === maxVotes) {
          winner.push(optionId);
        }
      }
      return winner;
    };
    
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', color: '#e6e6e6' }}>
            Results for: {selectedElection.title}
          </Typography>
          <Typography variant="body1" sx={{ color: '#8b949e', mt: 1 }}>
            {selectedElection.status === 'live' ? 'Live Tally' : 'Final Results'}
          </Typography>
          {userRole === 'admin' ? (
            <button className="secondary-button back-button" onClick={handleAdminBackToElections}>
              &larr; Back to Elections
            </button>
          ) : (
            <button className="secondary-button back-button" onClick={handleVoterBackToElections}>
              &larr; Back to Elections
            </button>
          )}
        </Box>
        {contests.length === 0 ? (
          <Typography variant="body1" sx={{ textAlign: 'center', color: '#8b949e' }}>
            No contests to show results for.
          </Typography>
        ) : (
          contests.map((contest) => {
            const contestOptions = options.filter(o => o.contestId === contest.id);
            const contestResults = results[contest.id] || {};
            const winnerIds = findWinner(contest.id);
            const isLive = selectedElection.status === 'live';
            
            const chartData = contestOptions.map(option => ({
              name: option.label,
              votes: contestResults[option.id] || 0
            }));

            return (
              <Box key={contest.id} sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ffffff', mb: 2 }}>
                  {contest.title}
                </Typography>
                
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {contestOptions.map((option, index) => {
                    const isWinningCandidate = winnerIds.includes(option.id);
                    const voteCount = contestResults[option.id] || 0;
                    return (
                      <Grid item xs={12} sm={6} md={4} key={option.id}>
                        <Card
                          sx={{
                            backgroundColor: '#1a1e23',
                            color: '#e6e6e6',
                            border: `2px solid ${isWinningCandidate ? (isLive ? '#58a6ff' : '#22863a') : '#30363d'}`,
                            boxShadow: `0 4px 10px rgba(0, 0, 0, 0.5)`,
                            borderRadius: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            p: 3,
                          }}
                        >
                          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                            {isWinningCandidate && (
                              <Chip
                                icon={isLive ? null : <EmojiEventsIcon />}
                                label={isLive ? 'Leading' : (winnerIds.length > 1 ? 'Tied Winner' : 'Winner')}
                                sx={{ backgroundColor: isLive ? '#58a6ff' : '#22863a', color: '#fff', fontWeight: 'bold' }}
                              />
                            )}
                          </Stack>
                          <Avatar
                            src={option.imageUrl}
                            sx={{ width: 80, height: 80, mb: 2, border: `2px solid ${isWinningCandidate ? (isLive ? '#58a6ff' : '#22863a') : 'transparent'}` }}
                          />
                          <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                            {option.label}
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1, color: '#58a6ff' }}>
                            {voteCount}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#8b949e' }}>
                            Votes
                          </Typography>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>

                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff', mb: 2, textAlign: 'center' }}>
                  Vote Distribution
                </Typography>
                <Box sx={{ height: 300, width: '100%', mb: 4, animation: 'fadeInUp 0.8s ease-out' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="name" stroke="#8b949e" />
                      <YAxis stroke="#8b949e" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1e23', border: '1px solid #30363d', borderRadius: '0.5rem' }}
                        labelStyle={{ color: '#e6e6e6' }}
                        itemStyle={{ color: '#e6e6e6' }}
                      />
                      <Legend />
                      <Bar dataKey="votes" fill="#58a6ff" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            );
          })
        )}
      </Container>
    );
  };

  const renderAdminPage = () => (
    <div className="page-content-container">
      <h2 className="page-heading">Admin Dashboard</h2>
      <p className="description">
        Create and manage elections.
      </p>
      {page === 'admin-manage-election' && selectedElection ? (
        selectedContest ? (
          // Options Management
          <>
            <h3 className="section-heading">Add Options to Contest: {selectedContest.title}</h3>
            <button className="secondary-button back-button" onClick={() => setSelectedContest(null)}>
              &larr; Back to Contests
            </button>
            <form onSubmit={handleAddOption} className="form-container">
              <input
                type="text"
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                placeholder="Option Label (e.g., Candidate A)"
                className="input-field"
                required
              />
              <p className="description-text" style={{ textAlign: 'left', marginTop: '0.5rem' }}>
                Upload an image or paste a URL below.
              </p>
              <input
                type="file"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="input-field"
                style={{ border: 'none', padding: '0.5rem 1rem' }}
              />
              <input
                type="text"
                value={newOptionImageUrl}
                onChange={(e) => setNewOptionImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="input-field"
                disabled={imageFile !== null}
              />
              <button type="submit" className="primary-button">Add Option</button>
            </form>
            <h4 className="sub-heading">Options</h4>
            {options.length === 0 ? (
              <p className="description-text">No options added yet.</p>
            ) : (
              <ul className="list-container">
                {options.map(option => (
                  <li key={option.id} className="contest-card">
                    <span className="contest-title">{option.label}</span>
                    <button onClick={() => handleDeleteOption(option.id)} className="delete-button">Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          // Contest Management
          <>
            <h3 className="section-heading">Manage Contest: {selectedElection.title}</h3>
            <button className="secondary-button back-button" onClick={handleAdminBackToElections}>
              &larr; Back to Elections
            </button>
            {contestError && (
              <div className="error-message">{contestError}</div>
            )}
            <form onSubmit={handleCreateContest} className="form-container">
              <input
                type="text"
                value={newContestTitle}
                onChange={(e) => setNewContestTitle(e.target.value)}
                placeholder="Contest Title"
                className="input-field"
                required
              />
              <textarea
                value={newContestDescription}
                onChange={(e) => setNewContestDescription(e.target.value)}
                placeholder="Contest Description (optional)"
                className="input-field"
                rows="3"
              />
              <button type="submit" className="primary-button">Create Contest</button>
            </form>

            <h4 className="sub-heading">Contests</h4>
            {contests.length === 0 ? (
              <p className="description-text">No contests created yet.</p>
            ) : (
              <ul className="list-container">
                {contests.map(contest => (
                  <li key={contest.id} className="contest-card" onClick={() => handleSelectContest(contest)}>
                    <span className="contest-title">{contest.title}</span>
                    <button onClick={() => handleDeleteContest(contest.id)} className="delete-button">Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      ) : (
        // Election Management
        <>
          {electionError && (
            <div className="error-message">
              {electionError}
            </div>
          )}
          <form onSubmit={handleCreateElection} className="form-container">
            <h3 className="section-heading">Create New Election</h3>
            <input
              type="text"
              value={newElectionTitle}
              onChange={(e) => setNewElectionTitle(e.target.value)}
              placeholder="Election Title"
              className="input-field"
              required
            />
            <button type="submit" className="primary-button">Create Election</button>
          </form>

          <div className="elections-list">
            <h3 className="section-heading">Elections</h3>
            {elections.length === 0 ? (
              <p className="description-text">No elections created yet.</p>
            ) : (
              <ul className="list-container">
                {elections.map(election => (
                  <li key={election.id} className="election-card">
                    <div className="list-item-content">
                      <span className="election-title">{election.title}</span>
                      <span className="election-status">{election.status}</span>
                      <div className="list-item-actions">
                        <select
                          className="status-dropdown"
                          value={election.status}
                          onChange={(e) => handleChangeElectionStatus(election.id, e.target.value)}
                        >
                          <option value="draft">Draft</option>
                          <option value="live">Live</option>
                          <option value="closed">Closed</option>
                        </select>
                        <button className="secondary-button" onClick={() => handleSelectElection(election)}>Manage</button>
                        <button className="secondary-button" onClick={() => handleViewResults(election)}>View Results</button>
                        <button onClick={() => handleDeleteElection(election.id)} className="delete-button">Delete</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );


  if (!isAuthReady) {
    return (
      <div className="app-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background-color: #0d1117;
        }

        .app-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: #0d1117;
          color: #c9d1d9;
          font-family: 'Inter', sans-serif;
          padding: 1rem;
        }

        .main-card {
          width: 100%;
          max-width: 32rem;
          padding: 2rem;
          background-color: #161b22;
          border-radius: 1rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          transition: transform 0.3s ease-in-out;
          border: 1px solid #30363d;
          animation: fadeInUp 0.5s ease-out;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .app-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: #e6e6e6;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .logout-button {
          padding: 0.5rem 1rem;
          background-color: #c93333;
          color: #ffffff;
          font-weight: bold;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s ease-in-out;
        }

        .logout-button:hover {
          background-color: #a42a2a;
        }

        .description {
          text-align: center;
          color: #8b949e;
          margin-bottom: 1.5rem;
        }

        .description-text {
          color: #8b949e;
        }

        .error-message {
          padding: 0.75rem;
          font-size: 0.875rem;
          color: #f8c9c9;
          background-color: #791c1c;
          border-radius: 0.5rem;
          border: 1px solid #571414;
          margin-top: 1rem;
        }

        .form-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #010409;
          border: 1px solid #30363d;
          border-radius: 0.5rem;
          color: #ffffff;
          outline: none;
          font-size: 1rem;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
        }

        .input-field:focus {
          border-color: #58a6ff;
          box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.5);
        }

        .form-heading {
          text-align: center;
          color: #e6e6e6;
          font-size: 1.25rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        .primary-button {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #58a6ff;
          color: #010409;
          font-weight: bold;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
          transition: transform 0.2s, background-color 0.2s;
        }

        .primary-button:hover {
          background-color: #388bfd;
          transform: translateY(-2px);
        }

        .primary-button:active {
          transform: translateY(1px);
        }

        .link-button {
          margin-left: 0.5rem;
          color: #58a6ff;
          font-weight: 600;
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s ease-in-out;
        }

        .link-button:hover {
          color: #388bfd;
        }

        .form-buttons {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .form-buttons .secondary-button {
          flex: 1;
        }

        .active-button {
          background-color: #c9d1d9;
          color: #1f1f1f;
          border-color: #c9d1d9;
        }
        .active-button:hover {
          background-color: #e6e6e6;
          transform: translateY(-2px);
        }

        .flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1rem;
        }

        .page-content-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .page-heading {
          font-size: 1.75rem;
          font-weight: bold;
          color: #ffffff;
          text-align: center;
        }

        .list-container {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .election-card, .contest-card, .option-card {
            padding: 1.25rem;
            background-color: #1a1e23;
            border-radius: 0.75rem;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: space-between;
            border: 1px solid #30363d;
            transition: transform 0.2s ease-in-out;
            cursor: pointer;
        }

        .election-card:hover, .contest-card:hover {
            transform: scale(1.02);
            background-color: #1f242b;
        }

        .election-title, .contest-title, .option-label {
            font-size: 1.2rem;
            font-weight: 600;
            color: #ffffff;
        }

        .election-status {
            font-size: 0.8rem;
            padding: 0.2rem 0.5rem;
            border-radius: 0.25rem;
            background-color: #21262d;
            color: #8b949e;
            text-transform: uppercase;
            font-weight: bold;
            margin-top: 0.5rem;
        }

        .candidate-card {
          padding: 1.25rem;
          background-color: #1a1e23;
          border-radius: 0.75rem;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          transition: transform 0.2s ease-in-out;
          cursor: pointer;
          border: 1px solid #30363d;
        }

        .candidate-card:hover {
          transform: scale(1.02);
          background-color: #1f242b;
        }

        .candidate-info {
          text-align: center;
          margin-bottom: 1rem;
        }

        .candidate-name {
          font-size: 1.5rem;
          font-weight: 600;
          color: #ffffff;
        }

        .candidate-slogan {
          color: #8b949e;
          font-size: 0.875rem;
        }

        .secondary-button {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #21262d;
          color: #c9d1d9;
          font-weight: bold;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          border: 1px solid #30363d;
          cursor: pointer;
          transition: background-color 0.2s ease-in-out, transform 0.2s;
        }
        .secondary-button:hover {
          background-color: #30363d;
          transform: translateY(-2px);
        }
        .secondary-button:active {
          transform: translateY(1px);
        }

        .success-message {
          padding: 0.75rem;
          font-size: 0.875rem;
          color: #bbf7d0;
          background-color: #14532d;
          border-radius: 0.5rem;
          text-align: center;
          border: 1px solid #22863a;
        }

        .results-card {
          padding: 1.5rem;
          background-color: #1a1e23;
          border-radius: 0.75rem;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
          border: 1px solid #30363d;
        }

        .section-heading {
          font-size: 1.25rem;
          font-weight: 600;
          color: #e6e6e6;
          text-align: center;
          margin-bottom: 1rem;
        }

        .vote-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid #2f363d;
        }

        .vote-item:last-child {
          border-bottom: none;
        }

        .vote-count {
          color: #58a6ff;
          font-weight: bold;
          font-size: 1.25rem;
        }

        .back-button {
          width: auto;
          margin-bottom: 1.5rem;
        }

        .sub-heading {
          font-size: 1.1rem;
          font-weight: 600;
          color: #ffffff;
          margin-top: 1.5rem;
        }

        .contest-card {
          padding: 1rem;
          background-color: #1a1e23;
          border: 1px solid #30363d;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .contest-card-expanded {
          padding: 1rem;
          background-color: #1a1e23;
          border: 1px solid #30363d;
          border-radius: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .contest-title {
          font-weight: 600;
        }

        .option-card {
          padding: 0.75rem;
          background-color: #0d1117;
          border: 1px solid #30363d;
          border-radius: 0.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .option-label {
          font-weight: 500;
        }
        .delete-button {
            padding: 0.3rem 0.6rem;
            background-color: #c93333;
            color: #ffffff;
            font-weight: bold;
            border-radius: 0.3rem;
            font-size: 0.75rem;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s ease-in-out;
        }
        .delete-button:hover {
            background-color: #a42a2a;
        }
        .list-item-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .list-item-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .status-dropdown {
          padding: 0.3rem 0.5rem;
          font-size: 0.75rem;
          border-radius: 0.25rem;
          background-color: #21262d;
          color: #c9d1d9;
          border: 1px solid #30363d;
        }
      `}</style>
      <div className="main-card">
        <header className="header">
          <h1 className="app-title">Online Voting</h1>
          {user && (
            <button
              onClick={handleLogout}
              className="logout-button"
            >
              Logout</button>
          )}
        </header>

        {!user ? renderAuthPage() : (
          <>
            {userRole === 'admin' && (page === 'results' ? renderResultsPage() : renderAdminPage())}
            {userRole === 'voter' && (
              page === 'voter-elections' ? (
                renderVoterElectionsPage()
              ) : page === 'voter-contests' && selectedElection ? (
                renderVoterContestPage()
              ) : page === 'results' && selectedElection ? (
                renderResultsPage()
              ) : (
                <div className="page-content-container">
                  <p className="description-text">Select an election to get started.</p>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}