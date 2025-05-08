
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let xScale, yScale; 

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));
  
    return data;
}


// Step 1.2: Process commit-level data
function processCommits(data) {
    return d3
        .groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];
            let { author, date, time, timezone, datetime } = first;
  
            let ret = {
                id: commit,
                url: 'https://github.com/personal-portfolio/commit/' + commit, // Change this if your repo is different
                author,
                date,
                time,
                timezone,
                datetime,
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };
    
            // Hidden property to keep original line-level data
            Object.defineProperty(ret, 'lines', {
                value: lines,
                writable: false,
                configurable: false,
                enumerable: false, // This makes it hidden from `console.log`
            });
  
            return ret;
        });
  }
  
// Step 1.3: Display stats
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
    const blocks = container
        .selectAll('div.stat')
        .data(stats)
        .enter()
        .append('div')
        .attr('class', 'stat');
    
    blocks.append('div').attr('class', 'label').text(d => d.label);
    blocks.append('div').attr('class', 'value').text(d => d.value);
}

let data = await loadData();
let commits = processCommits(data);
renderCommitInfo(data, commits);


// Step 2
function renderScatterPlot(data, commits) {
    // Put all the JS code of Steps inside this function
    const width = 1000;
    const height = 600;
    
    const margin = { top: 10, right: 10, bottom: 30, left: 40 };
    
    const usableArea = {
      top: margin.top,
      right: width - margin.right,
      bottom: height - margin.bottom,
      left: margin.left,
      width: width - margin.left - margin.right,
      height: height - margin.top - margin.bottom,
    };
    
    xScale = d3.scaleTime()
      .domain(d3.extent(commits, (d) => d.datetime))
      .range([margin.left, width - margin.right]);
  
    yScale = d3.scaleLinear()
      .domain([0, 24])
      .range([height - margin.bottom, margin.top]);
    
    const svg = d3
      .select('#chart')
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('width', '100%')
      .style('height', 'auto')  // or a fixed height like '600px'
      .style('overflow', 'visible');
    
    // Add dots **after scales are properly set**
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines); // Largest first

    const [minLines, maxLines] = d3.extent(sortedCommits, (d) => d.totalLines);
  
    const rScale = d3
      .scaleSqrt()
      .domain([minLines, maxLines])
      .range([2, 30]);
  
    const dots = svg.append("g").attr("class", "dots");

    createBrushSelector(svg);

    svg.call(d3.brush().on('start brush end', brushed));
    svg.selectAll('.dots, .overlay ~ *').raise();
    
    dots
      .selectAll("circle")
      .data(sortedCommits)
      .join("circle")
      .attr("cx", (d) => xScale(d.datetime))
      .attr("cy", (d) => yScale(d.hourFrac))
      .attr("r", (d) => rScale(d.totalLines))
      .attr("fill", "steelblue")
      .style("fill-opacity", 0.7)
      .on("mouseenter", (event, commit) => {
        d3.select(event.currentTarget).style("fill-opacity", 1);
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
      })
      .on("mousemove", updateTooltipPosition)
      .on("mouseleave", (event) => {
        d3.select(event.currentTarget).style("fill-opacity", 0.7);
        updateTooltipVisibility(false);
    });

    // Axes
    svg
      .append('g')
      .attr('transform', `translate(0, ${usableArea.bottom})`)
      .call(d3.axisBottom(xScale));
    
    svg
      .append('g')
      .attr('transform', `translate(${usableArea.left}, 0)`)
      .call(
        d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, '0') + ':00')
      );
    
    // Gridlines
    svg
      .append('g')
      .attr('class', 'gridlines')
      .attr('transform', `translate(${usableArea.left}, 0)`)
      .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

}
   
let data3 = await loadData();
let commits3 = processCommits(data3);
   
renderScatterPlot(data3, commits3);


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

function createBrushSelector(svg) {
  svg.call(d3.brush());
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