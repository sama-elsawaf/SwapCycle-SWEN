import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import { useAuth } from '../../hooks/useAuth';
import { useMeetingAreas } from '../../hooks/useMeetingAreas';
import type { InterestCategory, PrivacySettings } from '../../types';
import { INTEREST_CATEGORIES } from '../../utils/constants';
import { errorMessage } from '../../utils/errors';
import { Alert, SelectField } from '../PageParts';
import { ArrowRightIcon, CategoryIcon, Leaf, PinIcon, StepProgress } from './AuthDecor';

const TOTAL_STEPS = 3;

export default function Onboarding() {
  const { user, updateProfile } = useAuth();
  const { areas, error: areasError } = useMeetingAreas();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState<InterestCategory[]>(user?.interests ?? []);
  const [areaId, setAreaId] = useState<number | null>(user?.meetingArea?.id ?? null);
  const [privacy, setPrivacy] = useState<PrivacySettings>(
    user?.privacy ?? { showMeetingArea: true, showInterests: true },
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function toggleInterest(category: InterestCategory) {
    setInterests((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  }

  async function finish() {
    setSaving(true);
    setError(undefined);
    try {
      await updateProfile({ interests, meetingAreaId: areaId, privacy, onboardingCompleted: true });
      setStep(3);
    } catch (failure) {
      setError(errorMessage(failure, 'We could not save your choices. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    if (step > 1) setStep(step - 1);
    else navigate('/home');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-deep px-6 py-6 text-white">
      <Leaf className="absolute -right-6 top-10 h-40 w-auto rotate-[24deg] opacity-80" />
      <Leaf className="absolute -left-8 bottom-4 h-36 w-auto -rotate-12 opacity-80" />

      <div className="relative mx-auto w-full max-w-lg">
        <div className="flex items-center">
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goBack}
              aria-label={step > 1 ? 'Previous step' : 'Skip setup for now'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className="h-11 w-11" />
          )}
          <div className="flex-1">
            <StepProgress step={step} total={TOTAL_STEPS} label="Account setup progress" />
          </div>
          <span className="h-11 w-11" />
        </div>

        {step === 1 && (
          <section aria-labelledby="interests-title" className="mt-10">
            <h1 id="interests-title" className="font-display text-4xl font-bold text-white sm:text-5xl">
              What are your interests?
            </h1>
            <p className="mt-3 text-lg">Choose a few categories to get personalized book recommendations.</p>

            <div role="group" aria-label="Reading interests" className="mt-8 grid grid-cols-2 gap-3">
              {INTEREST_CATEGORIES.map((category) => (
                <Chip
                  key={category.value}
                  tone="dark"
                  label={category.label}
                  icon={<CategoryIcon category={category.value} />}
                  selected={interests.includes(category.value)}
                  onToggle={() => toggleInterest(category.value)}
                />
              ))}
            </div>

            <SelectField
              className="mt-8"
              tone="dark"
              label="Preferred Meeting Area"
              icon={<PinIcon />}
              value={areaId ?? ''}
              onChange={(event) => setAreaId(event.target.value ? Number(event.target.value) : null)}
              error={areasError ? 'Meeting areas could not be loaded. You can choose one later.' : undefined}
            >
              <option value="">Select an area</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </SelectField>
            <p className="mt-2 text-sm text-pink-light">
              We only ever share a general campus area, never your address.
            </p>

            <div className="mt-10">
              <Button variant="primary" fullWidth onClick={() => setStep(2)}>
                <span className="inline-flex items-center gap-2">
                  Next <ArrowRightIcon />
                </span>
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="privacy-title" className="mt-10">
            <h1 id="privacy-title" className="font-display text-4xl font-bold text-white sm:text-5xl">
              Your privacy
            </h1>
            <p className="mt-3 text-lg">
              Other readers always see your display name. Choose what else appears on your profile.
            </p>
            {error && (
              <div className="mt-6">
                <Alert tone="error">{error}</Alert>
              </div>
            )}
            <fieldset className="mt-8 space-y-4">
              <legend className="sr-only">Profile visibility</legend>
              <PrivacyToggle
                label="Show my meeting area"
                description="Helps readers nearby find swaps with you."
                checked={privacy.showMeetingArea}
                onChange={(checked) => setPrivacy({ ...privacy, showMeetingArea: checked })}
              />
              <PrivacyToggle
                label="Show my reading interests"
                description="Lets readers see what you like to read."
                checked={privacy.showInterests}
                onChange={(checked) => setPrivacy({ ...privacy, showInterests: checked })}
              />
            </fieldset>
            <div className="mt-10">
              <Button variant="primary" fullWidth loading={saving} disabled={saving} onClick={finish}>
                <span className="inline-flex items-center gap-2">
                  Save and continue <ArrowRightIcon />
                </span>
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="done-title" className="mt-10" role="status">
            <h1 id="done-title" className="font-display text-4xl font-bold text-white sm:text-5xl">
              You&apos;re all set{user ? `, ${user.displayName}` : ''}!
            </h1>
            <p className="mt-3 text-lg">List a book you are ready to pass on, or see what others are offering.</p>
            <div className="mt-10 space-y-4">
              <Button variant="primary" fullWidth onClick={() => navigate('/books/new')}>
                List a book
              </Button>
              <Button variant="secondary" fullWidth onClick={() => navigate('/home')}>
                Browse books
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function PrivacyToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-4 rounded-card border border-slate bg-navy p-4 focus-within:ring-2 focus-within:ring-rose">
      <input
        id={id}
        type="checkbox"
        aria-describedby={`${id}-description`}
        className="mt-1 h-5 w-5 cursor-pointer accent-rose-deep"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div>
        <label htmlFor={id} className="block cursor-pointer font-medium">
          {label}
        </label>
        <p id={`${id}-description`} className="text-sm text-pink-light">
          {description}
        </p>
      </div>
    </div>
  );
}
