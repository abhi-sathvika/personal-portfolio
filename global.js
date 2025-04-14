console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 2
// let navLinks = $$("nav a");

// let currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname
// );

// currentLink?.classList.add("current");


// Step 3 Automatic navigation menu

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/"
  : "/personal-portfolio/";

// Define pages
let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/abhi-sathvika', title: 'GitHub' },
];

// Create nav and add it to top of body
let nav = document.createElement('nav');
document.body.prepend(nav);

// Create each link and append
for (let p of pages) {
  let url = p.url;
  let title = p.title;

  // Prepend BASE_PATH if internal
  url = !url.startsWith('http') ? BASE_PATH + url : url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  // Highlight current page
  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  // Open external links in new tab
  a.target = a.host !== location.host ? '_blank' : '_self';

  nav.append(a);
}


// Step 4 Light & Dark Theme

document.addEventListener("DOMContentLoaded", () => {
    // Inject the theme dropdown at the top of the body
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <label class="color-scheme">
        Theme:
        <select id="theme-select">
          <option value="light dark">Automatic</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      `
    );
  
    const themeSelect = document.getElementById("theme-select");
    const root = document.documentElement;
  
    // Load the stored theme preference if it exists
    const stored = localStorage.getItem("color-scheme");
    if (stored) {
      root.style.colorScheme = stored;
      themeSelect.value = stored;
    }
  
    // Apply the selected theme when changed
    themeSelect.addEventListener("change", () => {
      const selected = themeSelect.value;
      root.style.colorScheme = selected;
      localStorage.setItem("color-scheme", selected);
    });
  });


// Step 5 Contact Form

const form = document.querySelector("#contact-form");

form?.addEventListener("submit", function (e) {
  e.preventDefault(); // Stop normal submission

  const data = new FormData(form);
  const params = [];

  for (let [name, value] of data) {
    const encoded = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    params.push(encoded);
  }

  const queryString = params.join("&");
  const url = `${form.action}?${queryString}`;

  // Open default email client with prefilled subject/body
  location.href = url;
});