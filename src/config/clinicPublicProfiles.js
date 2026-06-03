const publicAsset = (path) => `${process.env.PUBLIC_URL || ""}${path}`;

// Solução ponte: conteúdo público estático por clinic_id.
// Migrar futuramente para clinic_public_profiles no banco.
const cmtPublicProfile = {
  public_name: "Centro de Movimento",
  logo_url: publicAsset("/assets/clinics/cmt/logo.png"),
  logo_header_url: publicAsset("/assets/clinics/cmt/logo-header.png"),
  favicon_url: publicAsset("/assets/clinics/cmt/favicon.ico"),
  primary_color: "#064333",
  secondary_color: "#008F55",
  accent_color: "#00B967",
  hero_title: "Fisioterapia e Reabilitação",
  hero_subtitle:
    "Cuidado especializado para recuperar movimento, aliviar dores e melhorar sua qualidade de vida.",
  hero_quote: "Movimento, força e reabilitação com acompanhamento profissional.",
  hero_quote_author: "Centro de Movimento",
  hero_image_url: publicAsset("/assets/clinics/cmt/hero.svg"),
  about_title: "Sobre o Centro de Movimento",
  about_text: [
    "O Centro de Movimento atua com fisioterapia e reabilitação, oferecendo atendimento individualizado para auxiliar na recuperação funcional, melhora da mobilidade, alívio de dores e retorno seguro às atividades do dia a dia.",
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
  ],
  services_title: "Serviços",
  contact_title: "Contatos",
  contact_phone: "(27) 98847-2156",
  contact_whatsapp: "27988472156",
  contact_instagram: "https://www.instagram.com/cmtreabilitacao/",
  contact_instagram_label: "Instagram",
  contact_address: "Rua Abiail do Amaral Carneiro, 191, Enseada do Suá, sala 611",
};

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
  3: cmtPublicProfile,
  11: cmtPublicProfile,
};

export function getClinicPublicProfile(clinicId) {
  const normalizedClinicId = Number(clinicId);
  return clinicPublicProfiles[normalizedClinicId] || null;
}

export default clinicPublicProfiles;
