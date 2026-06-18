import React, { useState, useEffect } from 'react';
import api from '../../api';

// --- THE HARDCODED DRUG INTERACTION LIST ---
// This is a simple array of rules. If the patient is taking both Drug A and Drug B,
// we will show the warning message.
const KNOWN_INTERACTIONS = [
  { 
    drugA: 'warfarin', 
    drugB: 'aspirin', 
    warning: 'DANGER: High risk of severe bleeding! Both are blood thinners.' 
  },
  { 
    drugA: 'digoxin', 
    drugB: 'amiodarone', 
    warning: 'WARNING: Amiodarone increases Digoxin levels. Risk of toxicity.' 
  },
  {
    drugA: 'lisinopril',
    drugB: 'spironolactone',
    warning: 'CAUTION: Both increase potassium levels. Monitor kidney function.'
  }
];

export function MedicationsPage({ healthId }) {
  const [profile, setProfile] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Run this when the page loads
  useEffect(() => {
    // 1. Fetch the data from our new Express route
    const fetchPatient = async () => {
      try {
        // We use a hardcoded health ID here for testing, e.g., 'LL-A3X92'
        const response = await api.get(`/api/doctor/patient/${healthId}`);
        const patientProfile = response.data.medicalData;
        
        setProfile(patientProfile);
        
        // 2. Check for drug interactions!
        if (patientProfile.current_medications) {
          checkInteractions(patientProfile.current_medications);
        }
      } catch (error) {
        console.error("Error fetching patient", error);
      }
      setLoading(false);
    };

    fetchPatient();
  }, [healthId]);

  // --- THE NAIVE DRUG INTERACTION CHECKER ---
  const checkInteractions = (medicationsString) => {
    // Convert "Warfarin, Aspirin, Tylenol" into ["warfarin", "aspirin", "tylenol"]
    const currentMeds = medicationsString.toLowerCase().split(',').map(med => med.trim());
    
    let foundWarnings = [];

    // Loop through our hardcoded list of rules
    for (let i = 0; i < KNOWN_INTERACTIONS.length; i++) {
      const rule = KNOWN_INTERACTIONS[i];
      
      // If the patient's list includes BOTH Drug A and Drug B...
      if (currentMeds.includes(rule.drugA) && currentMeds.includes(rule.drugB)) {
        foundWarnings.push(rule.warning); // ...add the warning to our list!
      }
    }

    // Save the warnings to React state so they show up on screen
    setWarnings(foundWarnings);
  };

  if (loading) return <div>Loading patient data...</div>;
  if (!profile) return <div>No profile found.</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🩺 Doctor View: Patient Medications</h1>
      
      <div style={{ backgroundColor: '#f0f4f8', padding: '15px', borderRadius: '8px' }}>
        <h3>Current Medications:</h3>
        {/* Display the raw string of medications */}
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {profile.current_medications || "No medications listed."}
        </p>
      </div>

      {/* If we found any warnings, display them in a big red box! */}
      {warnings.length > 0 && (
        <div style={{ marginTop: '20px', backgroundColor: '#ffebe6', border: '2px solid red', padding: '15px', borderRadius: '8px' }}>
          <h3 style={{ color: 'red', marginTop: 0 }}>⚠️ DRUG INTERACTION ALERTS</h3>
          <ul>
            {warnings.map((alert, index) => (
              <li key={index} style={{ color: 'red', fontWeight: 'bold', marginBottom: '10px' }}>
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Displaying Kidney/Liver function which is crucial for heart meds */}
      <div style={{ marginTop: '20px' }}>
        <h3>Organ Function & Vitals</h3>
        <ul>
          <li><strong>Age:</strong> {profile.age}</li>
          <li><strong>Weight:</strong> {profile.weight}</li>
          <li><strong>Kidney/Liver Function:</strong> {profile.kidney_liver_function || 'Not recorded'}</li>
        </ul>
      </div>
    </div>
  );
}
