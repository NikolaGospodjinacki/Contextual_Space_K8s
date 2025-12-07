import { useState } from 'react';
import { Canvas } from './components/Canvas';
import { UsernameModal } from './components/UsernameModal';

function App() {
  const [username, setUsername] = useState<string | null>(null);

  // Test change for PR preview
  console.log('PR Preview Test - Version 1.0');

  if (!username) {
    return <UsernameModal onSubmit={setUsername} />;
  }

  return <Canvas username={username} />;
}

export default App;
