import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let xScale, yScale;
let commitProgress = 100;
let commitMaxTime;
let filteredCommits = [];
let commits = [];
let data = [];

const timeSlider = document.getElementById('timeSlider');
const selectedTime = document.getElementById('selectedTime');

// Load data from CSV and start the app
async function loadData() {
  const rawData = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  data = rawData;
  commits = processCommits(data);
  filteredCommits = commits;

  // Initialize time scale AFTER commits is populated
  timeScale = d3.scaleTime(
    [d3.min(commits, (d) => d.datetime), d3.max(commits, (d) => d.datetime)],
    [0, 100]
  );

  commitMaxTime = timeScale.invert(commitProgress);

  renderCommitInfo(data, commits);
  updateScatterPlot(data, commits);
  displayCommitFiles();
  initializeScrollytelling();
  renderItems(0); // Initialize both narrative and plot
}

let timeScale;

function updateTimeDisplay() {
  commitProgress = Number(timeSlider.value);
  commitMaxTime = timeScale.invert(commitProgress);
  selectedTime.textContent = commitMaxTime.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  filterCommitsByTime();
  updateScatterPlot(data, filteredCommits);
  displayCommitFiles();
}

timeSlider.addEventListener("input", updateTimeDisplay);

function filterCommitsByTime() {
  filteredCommits = commits.filter((commit) => commit.datetime <= commitMaxTime);
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: 'https://github.com/personal-portfolio/commit/' + commit, // Change this if needed
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        writable: false,
        configurable: false,
        enumerable: false,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
  const stats = [
    { label: 'COMMITS', value: commits.length },
    { label: 'FILES', value: d3.group(data, d => d.file).size },
    { label: 'TOTAL LOC', value: data.length },
    { label: 'LONGEST LINE', value: d3.max(data, d => d.length) },
    {
      label: 'MAX LINES',
      value: d3.max(
        d3.rollups(data, v => d3.max(v, d => d.line), d => d.file),
        d => d[1]
      ),
    },
  ];

  const container = d3.select('#stats');
  container.selectAll('div.stat').remove();
  
  const blocks = container
    .selectAll('div.stat')
    .data(stats)
    .enter()
    .append('div')
    .attr('class', 'stat');

  blocks.append('div').attr('class', 'label').text(d => d.label);
  blocks.append('div').attr('class', 'value').text(d => d.value);
}

function updateScatterPlot(data, commits) {
  const width = 800;
  const height = 400;
  const margin = { top: 160, right: 10, bottom: 1, left: 40 };

  d3.select('#chart').select('svg').remove();

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  if (!commits.length) return;

  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([margin.left, margin.left + chartWidth]);

  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([margin.top + chartHeight, margin.top]);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 20]);

  const dots = svg.append('g').attr('class', 'dots');

  // Add brush
  const brush = d3.brush()
    .extent([[margin.left, margin.top], [margin.left + chartWidth, margin.top + chartHeight]])
    .on('start brush end', brushed);

  svg.append('g')
    .attr('class', 'brush')
    .call(brush);

  dots.selectAll('circle')
    .data(commits)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .attr('opacity', 0.7)
    .attr('class', 'commit-dot')
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');

  svg.append('g')
    .attr('transform', `translate(0,${margin.top + chartHeight})`)
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(yAxis);

  // Gridlines
  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale)
      .tickFormat('')
      .tickSize(-chartWidth));

  // Raise dots above brush overlay
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function displayCommitFiles() {
  const lines = filteredCommits.flatMap((d) => d.lines);
  let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    });
  files = d3.sort(files, (d) => -d.lines.length);
  
  d3.select('.files').selectAll('div').remove();
  
  let filesContainer = d3
    .select('.files')
    .selectAll('div')
    .data(files)
    .enter()
    .append('div');
    
  filesContainer
    .append('dt')
    .html(
      (d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`,
    );
    
  filesContainer
    .append('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .enter()
    .append('div')
    .attr('class', 'line')
    .style('background', (d) => fileTypeColors(d.type));
}

function initializeScrollytelling() {
  // Commit scrollytelling
  let NUM_ITEMS = commits.length;
  let ITEM_HEIGHT = 70;
  let VISIBLE_COUNT = 10;
  let totalHeight = (NUM_ITEMS - 1) * ITEM_HEIGHT;

  const scrollContainer = d3.select('#scroll-container');
  const spacer = d3.select('#spacer');
  const itemsContainer = d3.select('#items-container');

  spacer.style('height', `${totalHeight}px`);

  scrollContainer.on('scroll', () => {
    const scrollTop = scrollContainer.property('scrollTop');
    let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
    renderItems(startIndex);
  });

  // File size scrollytelling
  let FILE_ITEM_HEIGHT = 70;
  let FILE_VISIBLE_COUNT = 10;
  let FILE_NUM_ITEMS = commits.length;
  let fileTotalHeight = (FILE_NUM_ITEMS - 1) * FILE_ITEM_HEIGHT;

  const fileScrollContainer = d3.select('#file-scroll-container');
  const fileSpacer = d3.select('#file-spacer');
  const fileItemsContainer = d3.select('#file-items-container');

  fileSpacer.style('height', `${fileTotalHeight}px`);

  fileScrollContainer.on('scroll', () => {
    const scrollTop = fileScrollContainer.property('scrollTop');
    let startIndex = Math.floor(scrollTop / FILE_ITEM_HEIGHT);
    startIndex = Math.max(0, Math.min(startIndex, commits.length - FILE_VISIBLE_COUNT));
    renderFileItems(startIndex);
  });
}

function renderItems(startIndex) {
  const ITEM_HEIGHT = 70;
  const VISIBLE_COUNT = 10;
  const itemsContainer = d3.select('#items-container');
  itemsContainer.selectAll('div').remove();

  const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
  const newCommitSlice = commits.slice(startIndex, endIndex);

  // Update scatterplot ONLY with visible commits
  updateScatterPlot(data, newCommitSlice);

  // Add narrative items
  itemsContainer.selectAll('div')
    .data(newCommitSlice)
    .enter()
    .append('div')
    .attr('class', 'item')
    .style('position', 'absolute')
    .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`)
    .html((commit, index) => {
      const date = new Date(commit.datetime).toLocaleString("en", {
        dateStyle: "full",
        timeStyle: "short"
      });
      const fileCount = d3.rollups(commit.lines, d => d.length, d => d.file).length;
      return `
        <p>
          On ${date}, I made 
          <a href="${commit.url}" target="_blank">
            ${index > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'}
          </a>.
          I edited ${commit.totalLines} lines across ${fileCount} files.
          Then I looked over all I had made, and I saw that it was very good.
        </p>
      `;
    });
}

function renderFileItems(startIndex) {
  const FILE_ITEM_HEIGHT = 70;
  const FILE_VISIBLE_COUNT = 10;
  const fileItemsContainer = d3.select('#file-items-container');
  fileItemsContainer.selectAll('div').remove();
  const endIndex = Math.min(startIndex + FILE_VISIBLE_COUNT, commits.length);
  const currentCommits = commits.slice(startIndex, endIndex);

  // Update file visualization
  filteredCommits = currentCommits;
  displayCommitFiles();

  // Render narrative
  fileItemsContainer
    .selectAll('div')
    .data(currentCommits)
    .enter()
    .append('div')
    .attr('class', 'file-item')
    .style('position', 'absolute')
    .style('top', (_, i) => `${i * FILE_ITEM_HEIGHT}px`)
    .html((commit, index) => {
      return `
        <p>
          On ${commit.datetime.toLocaleString("en", {
            dateStyle: "full",
            timeStyle: "short"
          })}, I edited <a href="${commit.url}" target="_blank">
          ${index > 0 ? 'another set of files' : 'my first set of files'}</a>—with ${commit.totalLines} total line changes.
        </p>
      `;
    });
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');

  if (!commit || Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  const padding = 10;
  tooltip.style.left = `${event.clientX + padding}px`;
  tooltip.style.top = `${event.clientY + padding}px`;
}

function brushed(event) {
  const selection = event.selection;

  d3.selectAll('circle')
    .classed('selected', (d) => isCommitSelected(selection, d));

  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  // Count number of lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

// Start the application
loadData();