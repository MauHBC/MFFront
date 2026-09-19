import styled from "styled-components";

export const Shell = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 47%) minmax(0, 53%);
  grid-template-rows: minmax(0, 1fr);
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  color: #0f172a;
  font-family: "Inter Variable", Inter, sans-serif;

  @media (max-width: 900px) {
    display: block;
    height: auto;
  }
`;

export const Institution = styled.aside`
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(18px, 3vh, 40px);
  padding: clamp(32px, 5vw, 76px);
  background: #e9f6f5;
  border-right: 1px solid #d5e7e7;

  @media (max-width: 900px) {
    display: none;
  }

  @media (max-height: 700px) {
    padding-top: 28px;
    padding-bottom: 28px;
  }
`;

export const BrandImage = styled.img`
  display: block;
  width: ${(props) => (props.$compact ? "190px" : "clamp(190px, 18vw, 250px)")};
  height: auto;
  max-width: 100%;
  padding: 0;
  object-fit: contain;

  @media (min-width: 901px) {
    display: ${(props) => (props.$compact ? "none" : "block")};
  }
`;

export const InstitutionVisual = styled.div`
  min-width: 0;
  display: grid;
  place-items: center;
  align-self: center;
  justify-self: center;
  width: min(100%, 57vh, 560px);
  aspect-ratio: 7 / 5;

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

export const InstitutionCopy = styled.div`
  max-width: 480px;

  h2 {
    font-family: "Sora Variable", Sora, sans-serif;
    font-size: clamp(1.8rem, 2.45vw, 2.7rem);
    font-weight: 650;
    line-height: 1.18;
    letter-spacing: -0.045em;
  }

  p {
    margin-top: 10px;
    color: #334155;
    font-size: clamp(0.94rem, 1.1vw, 1.07rem);
    line-height: 1.55;
  }
`;

export const FormPanel = styled.main`
  box-sizing: border-box;
  min-width: 0;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(32px, 5vw, 80px);
  background: #f5f7fa;

  @media (max-width: 900px) {
    padding: clamp(24px, 7vw, 56px);
  }

  @media (max-height: 700px) {
    padding-top: 24px;
    padding-bottom: 24px;
  }
`;

export const Content = styled.div`
  width: min(100%, 440px);
  min-width: 0;

  > img {
    margin-bottom: clamp(30px, 7vh, 72px);
  }

  header h1 {
    font-family: "Sora Variable", Sora, sans-serif;
    font-size: clamp(1.8rem, 2.3vw, 2.35rem);
    font-weight: 650;
    line-height: 1.22;
    letter-spacing: -0.04em;
  }

  header p {
    margin-top: 10px;
    color: #475569;
    font-size: 0.98rem;
    line-height: 1.55;
  }

  @media (max-width: 900px) {
    > img {
      margin-bottom: 32px;
    }
  }

  @media (max-height: 700px) {
    > img {
      margin-bottom: 24px;
    }
  }
`;
