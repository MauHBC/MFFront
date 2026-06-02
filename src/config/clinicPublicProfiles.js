const publicAsset = (path) => `${process.env.PUBLIC_URL || ""}${path}`;

// Solução ponte: conteúdo público estático por clinic_id.
// Migrar futuramente para clinic_public_profiles no banco.
const clinicPublicProfiles = {
  1: {
    public_name: "Espaço Cuidar",
    logo_url: publicAsset("/assets/clinics/espaco-cuidar/logo.png"),
    favicon_url: publicAsset("/assets/clinics/espaco-cuidar/favicon.ico"),
    primary_color: "#6A795C",
    secondary_color: "#3D5230",
    accent_color: "#A2B190",
    hero_title: "Fisioterapia Especializada",
    hero_subtitle:
      "Oferecemos um atendimento personalizado e focado nas necessidades de cada paciente.",
    hero_quote: "Se sua coluna falasse, o que ela diria para você?",
    hero_quote_author:
      "Leonardo do Carmo, especialista em tratamento de coluna.",
    hero_image_url: publicAsset("/assets/clinics/espaco-cuidar/hero.png"),
    about_title: "Sobre nós",
    about_text: [
      "Somos uma clínica dedicada ao cuidado com o movimento, à recuperação funcional e à promoção da saúde. Atuamos com fisioterapia, pilates e treinamento funcional, sempre com foco em um atendimento individualizado, humanizado e baseado em evidências.",
      "Acreditamos que cada pessoa é única. Por isso, nossos tratamentos são planejados de forma personalizada, respeitando as necessidades, objetivos e limites de cada paciente, seja na reabilitação, na prevenção de lesões ou na melhora da qualidade de vida.",
    ],
    about_image_urls: [
      publicAsset("/assets/clinics/espaco-cuidar/equipe.jpg"),
      publicAsset("/assets/clinics/espaco-cuidar/atendimento-1.jpg"),
      publicAsset("/assets/clinics/espaco-cuidar/atendimento-2.jpg"),
      publicAsset("/assets/clinics/espaco-cuidar/atendimento-3.jpg"),
    ],
    services: [
      {
        icon: "physio",
        title: "Fisioterapia",
        subtitle: "Tratamento personalizado",
      },
      {
        icon: "pilates",
        title: "Pilates",
        subtitle: "Força, equilíbrio e postura",
      },
      {
        icon: "functional",
        title: "Funcional",
        subtitle: "Movimento para o dia a dia",
      },
    ],
    services_title: "Conheça nossos serviços",
    contact_title: "Contatos",
    contact_phone: "55 27 99999-9999",
    contact_whatsapp:
      "https://wa.me/5527988252557?text=Olá%20EspacoCuidar%2C%20gostaria%20de%20mais%20informações.",
    contact_instagram: "https://www.instagram.com/multifisioreabilitacao/",
    contact_instagram_label: "Instagram",
    contact_address:
      "Rua Marquês de Monte Alegre - nº 5, Jardim da Penha, Vitória - ES.",
  },
  11: {
    public_name: "CMT Reabilitação",
    logo_url: publicAsset("/assets/clinics/cmt/logo.svg"),
    favicon_url: publicAsset("/assets/clinics/cmt/favicon.svg"),
    primary_color: "#1F6F68",
    secondary_color: "#174A45",
    accent_color: "#86C7BE",
    hero_title: "Reabilitação Especializada",
    hero_subtitle:
      "Atendimento personalizado para recuperação, movimento e qualidade de vida.",
    hero_quote: "Cuidado individualizado para cada etapa da reabilitação.",
    hero_quote_author: "CMT Reabilitação",
    hero_image_url: publicAsset("/assets/clinics/cmt/hero.svg"),
    about_title: "Sobre a CMT",
    about_text: [
      "Perfil provisório da CMT Reabilitação. Substituir este texto pela apresentação real da clínica antes do deploy público definitivo.",
      "Esta estrutura já está preparada para receber fotos, serviços, contatos e textos reais sem duplicar o sistema e sem depender do domínio.",
    ],
    about_image_urls: [
      publicAsset("/assets/clinics/cmt/atendimento-1.svg"),
      publicAsset("/assets/clinics/cmt/atendimento-2.svg"),
      publicAsset("/assets/clinics/cmt/atendimento-3.svg"),
      publicAsset("/assets/clinics/cmt/atendimento-4.svg"),
    ],
    services: [
      {
        icon: "physio",
        title: "Fisioterapia",
        subtitle: "Atendimento especializado",
      },
      {
        icon: "pilates",
        title: "Pilates",
        subtitle: "Movimento, força e postura",
      },
      {
        icon: "functional",
        title: "Funcional",
        subtitle: "Treino orientado para a rotina",
      },
      {
        icon: "physio",
        title: "Reabilitação",
        subtitle: "Recuperação funcional personalizada",
      },
    ],
    services_title: "Serviços",
    contact_title: "Contatos",
    contact_phone: "Telefone a definir",
    contact_whatsapp: null,
    contact_instagram: null,
    contact_instagram_label: "Instagram a definir",
    contact_address: "Endereço a definir",
  },
};

export function getClinicPublicProfile(clinicId) {
  const normalizedClinicId = Number(clinicId);
  return clinicPublicProfiles[normalizedClinicId] || null;
}

export default clinicPublicProfiles;
