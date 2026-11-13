import { useRef } from 'react';
import { useToday } from '../hooks/useToday';
import { Screen } from '../shared/Screen';
import { ClockSection } from './ClockSection';
import { FinalCtaSection } from './FinalCtaSection';
import { HeroSection } from './HeroSection';
import { HowItWorksSection } from './HowItWorksSection';
import { LandingHeader } from './LandingHeader';
import { PainSection } from './PainSection';
import { ProofSection } from './ProofSection';
import { RoomsSection } from './RoomsSection';
import { StreakSection } from './StreakSection';
import { useRevealOnScroll } from './useRevealOnScroll';

/** Draw the Landing: the page that explains ExecutionOS to someone who is not signed in. */
export function LandingScreen() {
    const today = useToday();
    const heroCtaRef = useRef<HTMLButtonElement>(null);
    const mainRef = useRef<HTMLElement>(null);
    useRevealOnScroll(mainRef);

    return (
        <Screen name="landing" className="landing-screen">
            <LandingHeader heroCtaRef={heroCtaRef} />
            <main ref={mainRef}>
                <HeroSection today={today} ctaRef={heroCtaRef} />
                <PainSection />
                <ClockSection today={today} />
                <HowItWorksSection />
                <ProofSection today={today} />
                <StreakSection today={today} />
                <RoomsSection />
                <FinalCtaSection today={today} />
            </main>
        </Screen>
    );
}
