import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let selectedIndex = -1;
let searchQuery = '';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

const searchInput = document.querySelector('.searchBar');
const svg = d3.select('svg#projects-pie-plot');
const legend = d3.select('.legend');
const colors = d3.scaleOrdinal(d3.schemePaired);
const radius = 50;

// Filter logic based on both search and pie selection
function getFilteredProjects() {
  let filtered = projects;

  if (searchQuery) {
    filtered = filtered.filter((project) => {
      let values = Object.values(project).join('\n').toLowerCase();
      return values.includes(searchQuery);
    });
  }

  if (selectedIndex !== -1 && pieData[selectedIndex]) {
    let selectedYear = pieData[selectedIndex].label;
    filtered = filtered.filter(p => p.year === selectedYear);
  }

  return filtered;
}

// Update UI
function updateView() {
  const filteredProjects = getFilteredProjects();
  renderProjects(filteredProjects, projectsContainer, 'h2');
  projectsTitle.textContent = `Projects (${filteredProjects.length})`;
  renderPieChart(filteredProjects);
}

// Search bar input event
searchInput.addEventListener('input', (event) => {
  searchQuery = event.target.value.toLowerCase();
  updateView();
});

// Pie chart rendering
let pieData = [];

function renderPieChart(filteredProjects) {
  svg.selectAll('*').remove();
  legend.selectAll('*').remove();

  // Always use the full project list to compute pie data
  const rolledData = d3.rollups(
    projects,
    (v) => v.length,
    (d) => d.year
  );

  const data = rolledData.map(([year, count]) => ({ label: year, value: count }));
  pieData = data;

  if (data.length === 0) return;

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(radius);
  const pie = d3.pie().value(d => d.value);
  const arcData = pie(data);

  // Draw pie slices
  arcData.forEach((d, i) => {
    svg.append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', selectedIndex === i ? 'red' : colors(i))
      .attr('class', selectedIndex === i ? 'selected' : '')
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
        updateView();
      });
  });

  // Draw legend
  data.forEach((d, i) => {
    legend.append('li')
      .attr('style', `--color:${colors(i)}`)
      .attr('class', selectedIndex === i ? 'selected' : '')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
        updateView();
      });
  });
}
updateView();