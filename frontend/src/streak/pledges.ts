import { t } from '../i18n/i18n';
import { at } from '../lib/arrays';

/** What the user says on the button of the streak screen: their word for the next day. */
export interface Pledge {
    /** Return the words, for the day the user is giving their word for. */
    say: (nextDay: number) => string;
}

interface PledgeOption extends Pledge {
    /** The first streak day this pledge fits. Talking about keeping a long streak alive would sound odd on day 1. */
    fromStreak?: number;
}

const PLEDGES: readonly PledgeOption[] = [
    { say: (nextDay) => t('streak.pledge.mine', { nextDay }) },
    { say: () => t('streak.pledge.noBreak'), fromStreak: 3 },
    { say: () => t('streak.pledge.word') },
    { say: () => t('streak.pledge.seeYou') },
    { say: (nextDay) => t('streak.pledge.taking', { nextDay }) },
    { say: (nextDay) => t('streak.pledge.lockedIn', { nextDay }) },
    { say: () => t('streak.pledge.flameLit'), fromStreak: 3 },
    { say: () => t('streak.pledge.notGoOut') },
    { say: () => t('streak.pledge.giveWord') },
    { say: () => t('streak.pledge.deal') },
    { say: (nextDay) => t('streak.pledge.backFor', { nextDay }) },
    { say: () => t('streak.pledge.notMissing') },
    { say: (nextDay) => t('streak.pledge.nothingStops', { nextDay }), fromStreak: 5 },
    { say: () => t('streak.pledge.keepBurning'), fromStreak: 7 },
    { say: () => t('streak.pledge.yessir') },
    { say: () => t('streak.pledge.noExcuses') }
];

/** Pick, at random, a pledge that fits a streak of this many days. `random` returns a number from 0 up to, but not including, 1. */
export function pickPledge(streak: number, random: () => number = Math.random): Pledge {
    const fitting = PLEDGES.filter(/** Keep the pledges that fit this streak. */ (pledge) => (pledge.fromStreak ?? 1) <= streak);
    return at(fitting, Math.floor(random() * fitting.length));
}
