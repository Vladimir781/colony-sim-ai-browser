const tutorialSteps = [
  'Добро пожаловать в симулятор колонии. Нажмите «Старт», чтобы агенты ожили.',
  'Следите за ресурсами во вкладке «Мир» и корректируйте поведение агентов.',
  'Вкладка «Агенты» показывает состояние каждого участника колонии.',
  'Настраивайте ИИ во вкладке «Настройки» и экспериментируйте с обучением.',
];

export function createHelpTab() {
  const element = document.createElement('div');
  element.className = 'tab-help';
  const heading = document.createElement('h2');
  heading.textContent = 'Справка и туториал';
  element.appendChild(heading);

  const description = document.createElement('p');
  description.textContent =
    'Используйте клавишу Tab для навигации по панели. Панель можно открыть и с клавиатуры.';
  element.appendChild(description);

  const tutorial = document.createElement('div');
  tutorial.className = 'tutorial-box';
  const stepText = document.createElement('p');
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Далее';
  nextBtn.addEventListener('click', () => advance());
  tutorial.appendChild(stepText);
  tutorial.appendChild(nextBtn);
  element.appendChild(tutorial);

  let step = 0;
  function advance() {
    step = (step + 1) % tutorialSteps.length;
    stepText.textContent = tutorialSteps[step];
  }
  stepText.textContent = tutorialSteps[0];

  return {
    element,
    onActivate() {
      step = 0;
      stepText.textContent = tutorialSteps[step];
    },
  };
}
