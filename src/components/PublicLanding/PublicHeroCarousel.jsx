import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  FaChevronLeft,
  FaChevronRight,
  FaPause,
  FaPlay,
} from "react-icons/fa";

const AUTO_INTERVAL_MS = 5200;
const SWIPE_THRESHOLD = 42;

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  return prefersReducedMotion;
}

export default function PublicHeroCarousel({ images, displayName }) {
  const safeImages = useMemo(() => (Array.isArray(images) ? images : []), [images]);
  const hasImages = safeImages.length > 0;
  const hasMultipleImages = safeImages.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const goTo = useCallback((nextIndex, { pause = true } = {}) => {
    if (!hasMultipleImages) return;
    setActiveIndex((currentIndex) => {
      const imageCount = safeImages.length;
      const normalized = ((nextIndex % imageCount) + imageCount) % imageCount;
      return normalized === currentIndex ? currentIndex : normalized;
    });
    if (pause) setIsPaused(true);
  }, [hasMultipleImages, safeImages.length]);

  const goNext = useCallback((options) => {
    goTo(activeIndex + 1, options);
  }, [activeIndex, goTo]);

  const goPrevious = useCallback(() => {
    goTo(activeIndex - 1);
  }, [activeIndex, goTo]);

  useEffect(() => {
    if (!hasMultipleImages || isPaused || prefersReducedMotion) return undefined;
    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % safeImages.length);
    }, AUTO_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [hasMultipleImages, isPaused, prefersReducedMotion, safeImages.length]);

  const handleKeyDown = (event) => {
    if (!hasMultipleImages) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrevious();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  };

  const handleTouchStart = (event) => {
    touchStartX.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta > 0) goPrevious();
    if (delta < 0) goNext();
  };

  if (!hasImages) {
    return (
      <FallbackPanel aria-label={`Resumo de ${displayName}`}>
        <FallbackLabel>Experiência integrada</FallbackLabel>
        <FallbackTitle>{displayName}</FallbackTitle>
        <FallbackList>
          <span>Atendimento personalizado</span>
          <span>Equipe especializada</span>
          <span>Movimento com segurança</span>
        </FallbackList>
      </FallbackPanel>
    );
  }

  return (
    <Frame
      role="region"
      aria-roledescription={hasMultipleImages ? "carrossel" : undefined}
      aria-label={`Fotos de ${displayName}`}
      tabIndex={hasMultipleImages ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Slides $count={safeImages.length} $activeIndex={activeIndex}>
        {safeImages.map((image, index) => (
          <Slide key={image.src} aria-hidden={index !== activeIndex}>
            <img src={image.src} alt={image.alt} draggable="false" />
          </Slide>
        ))}
      </Slides>
      <ImageShade />

      {hasMultipleImages && (
        <>
          <ArrowButton
            type="button"
            $side="left"
            aria-label="Foto anterior"
            onClick={goPrevious}
          >
            <FaChevronLeft />
          </ArrowButton>
          <ArrowButton
            type="button"
            $side="right"
            aria-label="Próxima foto"
            onClick={() => goNext()}
          >
            <FaChevronRight />
          </ArrowButton>
          <CarouselFooter>
            <Indicators aria-label="Selecionar foto">
              {safeImages.map((image, index) => (
                <Indicator
                  key={image.src}
                  type="button"
                  aria-label={`Mostrar foto ${index + 1}`}
                  aria-current={index === activeIndex}
                  $active={index === activeIndex}
                  onClick={() => goTo(index)}
                />
              ))}
            </Indicators>
            <PauseButton
              type="button"
              aria-label={isPaused ? "Retomar troca automática" : "Pausar troca automática"}
              onClick={() => setIsPaused((current) => !current)}
            >
              {isPaused ? <FaPlay /> : <FaPause />}
            </PauseButton>
          </CarouselFooter>
        </>
      )}
    </Frame>
  );
}

PublicHeroCarousel.propTypes = {
  displayName: PropTypes.string.isRequired,
  images: PropTypes.arrayOf(PropTypes.shape({
    src: PropTypes.string.isRequired,
    alt: PropTypes.string.isRequired,
  })).isRequired,
};

const Frame = styled.div`
  position: relative;
  min-height: clamp(420px, 58vw, 680px);
  overflow: hidden;
  border-radius: 8px;
  background: #edf0ea;
  box-shadow: 0 24px 70px rgba(22, 33, 28, 0.16);
  isolation: isolate;

  &:focus-visible {
    outline: 3px solid var(--public-accent-color, #a2b190);
    outline-offset: 4px;
  }

  @media (max-width: 760px) {
    min-height: 300px;
  }
`;

const Slides = styled.div`
  height: 100%;
  min-height: inherit;
  display: flex;
  transform: translateX(${({ $activeIndex }) => `-${$activeIndex * 100}%`});
  transition: transform 720ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Slide = styled.div`
  flex: 0 0 100%;
  min-width: 0;

  img {
    width: 100%;
    height: 100%;
    min-height: inherit;
    object-fit: cover;
    display: block;
    user-select: none;
  }
`;

const ImageShade = styled.div`
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.2)),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 46%);
  pointer-events: none;
  z-index: 1;
`;

const ArrowButton = styled.button`
  position: absolute;
  top: 50%;
  ${({ $side }) => ($side === "left" ? "left: 18px;" : "right: 18px;")}
  z-index: 2;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.56);
  background: rgba(255, 255, 255, 0.76);
  color: #1b1b1b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: translateY(-50%);
  cursor: pointer;
  backdrop-filter: blur(12px);

  &:hover,
  &:focus-visible {
    background: #fff;
    outline: none;
  }
`;

const CarouselFooter = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
`;

const Indicators = styled.div`
  display: inline-flex;
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
`;

const Indicator = styled.button`
  width: ${({ $active }) => ($active ? "26px" : "9px")};
  height: 9px;
  border: 0;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? "var(--public-primary-color, #6a795c)" : "rgba(27, 27, 27, 0.32)")};
  cursor: pointer;
  transition: width 180ms ease, background 180ms ease;
`;

const PauseButton = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.56);
  background: rgba(255, 255, 255, 0.82);
  color: #1b1b1b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(12px);
`;

const FallbackPanel = styled.div`
  min-height: clamp(420px, 58vw, 680px);
  border-radius: 8px;
  padding: clamp(28px, 5vw, 64px);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.68)),
    linear-gradient(135deg, rgba(106, 121, 92, 0.18), rgba(162, 177, 144, 0.08));
  border: 1px solid rgba(106, 121, 92, 0.18);
  box-shadow: 0 24px 70px rgba(22, 33, 28, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 18px;

  @media (max-width: 760px) {
    min-height: 300px;
  }
`;

const FallbackLabel = styled.span`
  color: var(--public-secondary-color, #3d5230);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const FallbackTitle = styled.strong`
  color: #18211d;
  font-size: clamp(2rem, 5vw, 4.4rem);
  line-height: 0.98;
`;

const FallbackList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  span {
    padding: 9px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.7);
    color: #394437;
    font-weight: 700;
    font-size: 0.84rem;
  }
`;
