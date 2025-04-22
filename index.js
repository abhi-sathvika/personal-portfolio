import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h2');

const githubData = await fetchGitHubData('abhi-sathvika');
const profileStats = document.querySelector('#profile-stats');

// if (profileStats) {
//     profileStats.innerHTML = `
//       <h2>📊 GitHub Stats</h2>
//       <dl class="github-grid">
//         <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
//         <dt>Gists:</dt><dd>${githubData.public_gists}</dd>
//         <dt>Followers:</dt><dd>${githubData.followers}</dd>
//         <dt>Following:</dt><dd>${githubData.following}</dd>
//       </dl>
//     `;
//   }

if (profileStats) {
    profileStats.innerHTML = `
      <h2>📊 GitHub Stats</h2>
      <dl class="github-grid">
        <div><dt>Public Repos:</dt><dd>${githubData.public_repos}</dd></div>
        <div><dt>Gists:</dt><dd>${githubData.public_gists}</dd></div>
        <div><dt>Followers:</dt><dd>${githubData.followers}</dd></div>
        <div><dt>Following:</dt><dd>${githubData.following}</dd></div>
      </dl>
    `;
  }