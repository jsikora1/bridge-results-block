document.addEventListener('DOMContentLoaded', function() {
    if (typeof bridgeResultsData === 'undefined' || !Array.isArray(bridgeResultsData.results)) return;

    const settings = bridgeResultsData.settings;
    if (!settings.showTableHeader) return;

    const container = document.querySelector('#results-container');
    const table = document.querySelector('#results-table');
    const tbody = table.querySelector('tbody');

    // Search box
    const searchBox = document.createElement('input');
    searchBox.setAttribute('type', 'search');
    searchBox.setAttribute('placeholder', 'Search tournament...');
    searchBox.className = 'results-search-box';
    container.prepend(searchBox);

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export CSV';
    exportBtn.className = 'results-export-btn';
    exportBtn.onclick = () => {
        const csvRows = [Array.from(table.querySelectorAll('thead th')).map(th => th.textContent).join(',')];
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            const cols = Array.from(tr.querySelectorAll('td')).map(td => `"${td.innerText.replace(/"/g, '""')}"`);
            csvRows.push(cols.join(','));
        });
        const csv = csvRows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bridge_results.csv';
        link.click();
        URL.revokeObjectURL(url);
    };
    container.prepend(exportBtn);

    // Sorting
    const headers = table.querySelectorAll('thead th');
    headers.forEach((th, i) => {
        th.style.cursor = 'pointer';
        let asc = true;
        th.addEventListener('click', () => {
            const rowsArray = Array.from(tbody.querySelectorAll('tr'));
            rowsArray.sort((a, b) => {
                const aText = a.children[i].textContent.trim();
                const bText = b.children[i].textContent.trim();
                return asc ? aText.localeCompare(bText, undefined, { numeric: true }) : bText.localeCompare(aText, undefined, { numeric: true });
            });
            tbody.innerHTML = '';
            rowsArray.forEach(row => tbody.appendChild(row));
            asc = !asc;
        });
    });

    // Search filtering
    searchBox.addEventListener('input', () => {
        const keyword = searchBox.value.toLowerCase();
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(keyword) ? '' : 'none';
        });
    });
});
