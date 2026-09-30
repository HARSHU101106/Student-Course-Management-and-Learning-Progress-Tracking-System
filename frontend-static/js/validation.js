// validation.js — validation rules plus small DOM helpers to bind them
// to a <form>. Used by login.html and register.html.

export const rules = {
  name: (v) => (v.trim().length < 2 ? 'Enter your full name, at least 2 characters.' : ''),
  email: (v) => {
    if (!v.trim()) return 'Enter your email address.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email such as name@college.edu.';
  },
  phone: (v) => (/^\d{10}$/.test(v.replace(/\s/g, '')) ? '' : 'Enter a 10-digit phone number.'),
  dept: (v) => (!v ? 'Choose your department.' : ''),
  password: (v) => {
    if (v.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Include at least one letter and one number.';
    return '';
  },
  loginPassword: (v) => (!v ? 'Enter your password.' : (v.length < 8 ? 'Passwords have at least 8 characters.' : '')),
  confirm: (v, form) => (v !== form.elements.password.value ? 'Passwords do not match.' : '')
};

function setFieldState(input, message) {
  const field = input.closest('.field');
  const msg = field.querySelector('.msg');
  field.classList.toggle('invalid', !!message);
  field.classList.toggle('valid', !message && input.value !== '');
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  msg.textContent = message || (input.value ? 'Looks good' : '');
}

// Wires live validation + submit handling for a form.
// ruleMap: { fieldName: validatorFn }, onValid: (FormData) => void
export function bindForm(form, ruleMap, onValid) {
  const check = (name) => {
    const input = form.elements[name];
    const message = ruleMap[name](input.value, form);
    setFieldState(input, message);
    return !message;
  };

  Object.keys(ruleMap).forEach((name) => {
    const input = form.elements[name];
    if (!input) return;
    input.addEventListener('blur', () => { input.dataset.touched = '1'; check(name); });
    input.addEventListener('input', () => {
      if (input.dataset.touched) check(name);
      if (name === 'password' && form.elements.confirm && form.elements.confirm.dataset.touched) check('confirm');
    });
  });

  form.querySelectorAll('.reveal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let firstInvalid = null;
    Object.keys(ruleMap).forEach((name) => {
      const ok = check(name);
      if (!ok && !firstInvalid) firstInvalid = form.elements[name];
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    onValid(new FormData(form));
  });
}
