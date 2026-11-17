const products = {
  strip: { title: 'Щётка-планка', image: 'strip', dimensions: ['Длина', 'Ширина'] },
  roller: { title: 'Вал или ролик', image: 'roller', dimensions: ['Длина', 'Диаметр'] },
  disc: { title: 'Дисковая щётка', image: 'disc', dimensions: ['Диаметр', 'Посадочный диаметр'] },
  other: { title: 'Другой тип', image: 'renewal', dimensions: [] }
};
const modes = { make: 'Изготовление', restore: 'Восстановление' };
const sizes = new Intl.NumberFormat('ru-RU');
const $ = selector => document.querySelector(selector);

const form = $('#quote');
const field = name => form.elements.namedItem(name);
const type = field('type');
const dimensions = [field('dimension1'), field('dimension2')];
const labels = [$('#dim-label-1'), $('#dim-label-2')];
const formSteps = [$('#step-1'), $('#step-2')];
const stepLabels = [$('#index-1'), $('#index-2')];
const fileInput = $('#files');
const fileList = $('#file-list');
const fileError = $('#file-error');
const dropzone = $('#dropzone');
const summaryPhoto = $('#summary-img');
const dialog = $('#result-dialog');
const attachments = [];

let currentStep = 0;
let lastType = type.value;

function dimensionValues() {
  return products[type.value].dimensions.flatMap((label, index) => {
    const value = dimensions[index].valueAsNumber;
    return dimensions[index].validity.valid && Number.isFinite(value)
      ? [[label, `${sizes.format(value)} мм`]]
      : [];
  });
}

function updateSummary() {
  const product = products[type.value];
  const image = `assets/${product.image}.webp`;
  if (summaryPhoto.getAttribute('src') !== image) summaryPhoto.src = image;
  $('#summary-type').textContent = product.title;
  $('#summary-mode').textContent = modes[field('mode').value];
  $('#summary-dims').textContent = dimensionValues().map(([name, value]) => `${name.toLocaleLowerCase('ru')} ${value}`).join(' · ') || '—';
  $('#summary-qty').textContent = field('quantity').validity.valid ? `${sizes.format(field('quantity').valueAsNumber)} шт.` : '—';
  $('#summary-files').textContent = String(attachments.length);
}

function updateType() {
  const product = products[type.value];
  const changed = lastType !== type.value;
  for (const [index, input] of dimensions.entries()) {
    const label = product.dimensions[index];
    input.disabled = !label;
    input.parentElement.hidden = !label;
    if (label) labels[index].textContent = `${label}, мм`;
    if (changed) input.value = '';
  }
  $('#dimension-row').hidden = !product.dimensions.length;
  lastType = type.value;
  updateSummary();
}

function showStep(index, focus = true) {
  currentStep = index;
  formSteps.forEach((step, i) => { step.hidden = i !== index; });
  stepLabels.forEach((label, i) => {
    if (i === index) label.setAttribute('aria-current', 'step');
    else label.removeAttribute('aria-current');
  });
  if (focus) {
    stepLabels[index].tabIndex = -1;
    stepLabels[index].focus({ preventScroll: true });
    form.scrollIntoView({ block: 'start' });
  }
}

function showFileError(message = '') {
  fileError.textContent = message;
  fileError.hidden = !message;
}

function removeAttachment(item) {
  attachments.splice(attachments.indexOf(item), 1);
  if (item.blobUrl) URL.revokeObjectURL(item.preview);
  showFileError();
  renderFiles();
}

function renderFiles() {
  fileList.hidden = !attachments.length;
  fileList.replaceChildren(...attachments.map(item => {
    const row = document.createElement('li');
    if (item.preview) {
      const image = document.createElement('img');
      image.src = item.preview;
      image.alt = '';
      row.append(image);
    }
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = item.name;
    const remove = document.createElement('button');
    remove.className = 'remove-file';
    remove.type = 'button';
    remove.textContent = 'Удалить';
    remove.setAttribute('aria-label', `Удалить ${item.name}`);
    remove.addEventListener('click', () => {
      removeAttachment(item);
      ($('#file-list .remove-file') ?? $('#browse')).focus();
    });
    row.append(name, remove);
    return row;
  }));
  updateSummary();
}

function clearFiles() {
  for (const item of attachments) {
    if (item.blobUrl) URL.revokeObjectURL(item.preview);
  }
  attachments.length = 0;
  fileInput.value = '';
  showFileError();
  renderFiles();
}

function addFiles(files) {
  const issues = new Set();
  for (const file of files) {
    if (!/\.(?:jpe?g|png|webp|heic|heif|pdf|dxf|dwg|stp|step)$/i.test(file.name)) {
      issues.add('Выберите фото или чертёж в поддерживаемом формате.');
      continue;
    }
    if (file.size > 15 * 1024 * 1024) {
      issues.add('Каждый файл должен быть не больше 15 МБ.');
      continue;
    }
    if (attachments.some(item => item.name === file.name && item.size === file.size && item.modified === file.lastModified)) continue;
    if (attachments.length >= 5) {
      issues.add('Можно прикрепить до 5 файлов.');
      break;
    }
    const preview = /^image\/(?:jpeg|png|webp)$/i.test(file.type) ? URL.createObjectURL(file) : '';
    attachments.push({ name: file.name, size: file.size, modified: file.lastModified, preview, blobUrl: Boolean(preview) });
  }
  showFileError([...issues].join(' '));
  renderFiles();
}

$('#browse').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});
dropzone.addEventListener('dragover', event => {
  if (![...event.dataTransfer.types].includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', event => {
  if (!event.relatedTarget || !dropzone.contains(event.relatedTarget)) dropzone.classList.remove('dragging');
});
dropzone.addEventListener('drop', event => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  addFiles(event.dataTransfer.files);
});

form.addEventListener('input', event => {
  if (event.target === type) updateType();
  else if (event.target === field('customer')) event.target.setCustomValidity('');
  else updateSummary();
});
$('#back').addEventListener('click', () => showStep(0));

for (const link of document.querySelectorAll('[data-config]')) {
  link.addEventListener('click', () => {
    type.value = link.dataset.config;
    field('mode').value = link.dataset.mode;
    updateType();
    showStep(0, false);
  });
}

$('#example').addEventListener('click', () => {
  form.reset();
  field('customer').setCustomValidity('');
  clearFiles();
  type.value = 'disc';
  field('mode').value = 'restore';
  updateType();
  dimensions[0].value = '430';
  dimensions[1].value = '80';
  field('material').value = 'Синтетический';
  field('quantity').value = '2';
  field('equipment').value = 'Поломоечная машина';
  field('note').value = 'Нужен мягкий ворс для плитки. Основа сохранилась.';
  field('customer').value = 'Демо-заказчик';
  field('email').value = 'demo@example.com';
  attachments.push({ name:'Пример фото дисковой щётки.webp', preview:'assets/disc.webp' });
  renderFiles();
  showStep(0);
});

function validStep(index) {
  for (const input of formSteps[index].querySelectorAll('input, select, textarea')) {
    if (input.willValidate && !input.checkValidity()) {
      if (currentStep !== index) showStep(index, false);
      input.reportValidity();
      return false;
    }
  }
  return true;
}

function createResultRow([label, value]) {
  const row = document.createElement('div');
  const title = document.createElement('dt');
  const info = document.createElement('dd');
  title.textContent = label;
  info.textContent = value;
  row.append(title, info);
  return row;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!validStep(0)) return;
  if (currentStep === 0) {
    showStep(1);
    return;
  }
  const customer = field('customer');
  customer.setCustomValidity(customer.value.trim() ? '' : 'Укажите имя.');
  if (!validStep(1)) return;
  const entries = [
    ['Задача', modes[field('mode').value]],
    ['Изделие', products[type.value].title],
    ...dimensionValues(),
    ['Ворс', field('material').value || 'Нужна консультация'],
    ['Количество', `${sizes.format(field('quantity').valueAsNumber)} шт.`],
    ['Оборудование', field('equipment').value.trim()],
    ['Комментарий', field('note').value.trim()],
    ['Имя', customer.value.trim()],
    ['Почта', field('email').value.trim()]
  ].filter(([, value]) => value);
  $('#result-data').replaceChildren(...entries.map(createResultRow));
  $('#result-attachments').hidden = !attachments.length;
  $('#result-files').replaceChildren(...attachments.map(item => {
    const row = document.createElement('li');
    row.textContent = item.name;
    return row;
  }));
  dialog.showModal();
  $('#result-title').focus();
});

dialog.addEventListener('click', event => {
  if (event.target.closest('[data-close]')) dialog.close();
  if (event.target !== dialog) return;
  const { left, right, top, bottom } = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
});

const menu = $('.menu');
const nav = $('#nav');
function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  nav.classList.toggle('open', open);
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    setMenu(false);
    menu.focus();
  }
});
matchMedia('(max-width:850px)').addEventListener('change', () => setMenu(false));

updateType();
