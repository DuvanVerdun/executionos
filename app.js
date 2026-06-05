const startWorkBtn = document.getElementById('start-work-btn');

startWorkBtn.addEventListener('click', () => {
    const planScreen = document.querySelector('.plan-screen');
    const focusScreen = document.querySelector('.focus-screen');
    planScreen.style.display = 'none';
    focusScreen.style.display = 'flex';
    const missionInput = document.getElementById('mission-input').value;
    document.getElementById('mission-display').textContent = `Mission: ${missionInput}`;
})