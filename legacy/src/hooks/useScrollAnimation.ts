import { useEffect, useRef } from 'react';

export function useScrollAnimation() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.querySelectorAll('.animate-on-scroll, .animate-on-scroll-left, .animate-on-scroll-right').forEach((child) => {
              child.classList.add('is-visible');
            });
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return ref;
}

export function useElementAnimation(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    const elements = ref.current?.querySelectorAll('.animate-on-scroll, .animate-on-scroll-left, .animate-on-scroll-right');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
