import { useState } from 'react';
import { Canvas } from './components/Canvas';
import { UsernameModal } from './components/UsernameModal';

function App() {
  const [username, setUsername] = useState<string | null>(null);

  if (!username) {
    return <UsernameModal onSubmit={setUsername} />;
  }

  return <Canvas username={username} />;
}

export default App;
