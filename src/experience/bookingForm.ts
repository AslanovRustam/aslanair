/** What is wrong with a field of the booking form, if anything. */
export interface BookingErrors {
  name?: 'required' | 'short';
  email?: 'required' | 'invalid';
}

/** One @, a name before it and a domain after it with a dot and an ending of two letters or more, no spaces. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The outro's booking form (nothing is ever sent): a name of two letters or more and a well-formed e-mail, both
 * trimmed; the comment is optional. Returns only the fields that are wrong.
 */
export function validateBooking(form: { name: string; email: string }): BookingErrors {
  const errors: BookingErrors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  if (!name) errors.name = 'required';
  else if (name.length < 2) errors.name = 'short';
  if (!email) errors.email = 'required';
  else if (!EMAIL.test(email)) errors.email = 'invalid';
  return errors;
}
