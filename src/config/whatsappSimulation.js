export const isLocalWhatsAppSimulation = () => process.env.NODE_ENV === 'development'
  || (process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW === 'true'
    && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));
