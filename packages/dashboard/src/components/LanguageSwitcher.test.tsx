import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { I18nProvider } from '@/lib/i18n'; // assuming provider exists

test('language switch toggles without showing code', () => {
  const { getByRole, queryByText } = render(
    <I18nProvider>
      <LanguageSwitcher />
    </I18nProvider>
  );
  const button = getByRole('button');
  // initial language may be 'en' default; ensure no code displayed
  expect(queryByText(/EN|FR/)).toBeNull();
  fireEvent.click(button);
  // after toggle still no language code displayed
  expect(queryByText(/EN|FR/)).toBeNull();
});
