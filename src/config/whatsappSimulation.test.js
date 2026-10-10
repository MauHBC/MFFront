import { isLocalWhatsAppSimulation } from './whatsappSimulation';

test('build normal mantém controles locais desligados mesmo em localhost', () => {
  const previous = process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW;
  delete process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW;
  expect(isLocalWhatsAppSimulation()).toBe(false);
  if (previous !== undefined) process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW = previous;
});

test('flag explícita só habilita prévia no loopback', () => {
  const previous = process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW;
  process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW = 'true';
  expect(isLocalWhatsAppSimulation()).toBe(['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));
  if (previous === undefined) delete process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW;
  else process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW = previous;
});

test('hostname público não expõe simulação mesmo com flag de prévia', () => {
  const previous = process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW;
  const location = Object.getOwnPropertyDescriptor(window, 'location');
  try {
    process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW = 'true';
    Object.defineProperty(window, 'location', { configurable: true, value: new URL('https://clinic.example.test') });
    expect(isLocalWhatsAppSimulation()).toBe(false);
  } finally {
    Object.defineProperty(window, 'location', location);
    if (previous === undefined) delete process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW;
    else process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW = previous;
  }
});
