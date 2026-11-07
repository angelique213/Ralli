import { useNavigate } from 'react-router'
import ChallengeForm from '../components/ChallengeForm.jsx'

function CreateChallenge({ user }) {
  const navigate = useNavigate()
  return <main className="container challenges-page challenge-details"><ChallengeForm user={user} onCancel={() => navigate('/challenges')} onSaved={(saved) => navigate(`/challenges/${saved.id}`, { replace: true })} /></main>
}
export default CreateChallenge
