(function () {
    const modalEl = document.getElementById('entryModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const form = document.getElementById('entryForm');
    const title = document.getElementById('entryModalTitle');
    const f = (name) => form.querySelector(`[name="Input.${name}"]`);
    const fields = ['Id', 'Name', 'Brand', 'Meal', 'ServingDescription', 'Servings', 'Calories', 'ProteinG', 'CarbsG', 'FatG'];
    const total = document.getElementById('entryTotal');

    const updateTotal = () => {
        const kcal = (parseFloat(f('Calories').value) || 0) * (parseFloat(f('Servings').value) || 0);
        total.textContent = `${Math.round(kcal).toLocaleString()} kcal`;
    };
    form.addEventListener('input', updateTotal);

    const clearValidation = () => {
        form.querySelectorAll('.validation-summary-errors').forEach((el) => {
            el.classList.replace('validation-summary-errors', 'validation-summary-valid');
            el.querySelectorAll('li').forEach((li) => li.remove());
        });
    };

    const open = (mode, values) => {
        clearValidation();
        form.action = mode === 'edit' ? form.dataset.editAction : form.dataset.addAction;
        title.textContent = mode === 'edit' ? 'Edit food' : 'Add food';
        const defaults = { Id: '', Name: '', Brand: '', ServingDescription: '', Servings: 1, Calories: '', ProteinG: '', CarbsG: '', FatG: '' };
        const v = Object.assign({}, defaults, values);
        fields.forEach((k) => {
            const el = f(k);
            if (el && v[k] !== undefined && v[k] !== null) el.value = v[k];
            else if (el && k !== 'Meal') el.value = '';
        });
        updateTotal();
        modal.show();
    };

    modalEl.addEventListener('shown.bs.modal', () => f('Name').focus());

    document.querySelectorAll('[data-add-meal]').forEach((btn) =>
        btn.addEventListener('click', () => open('add', { Meal: btn.dataset.addMeal })));

    document.querySelectorAll('[data-edit]').forEach((btn) =>
        btn.addEventListener('click', () => {
            const d = JSON.parse(btn.dataset.edit);
            open('edit', {
                Id: d.id, Meal: d.meal, Name: d.name, Brand: d.brand, ServingDescription: d.servingDescription,
                Servings: d.servings, Calories: d.calories, ProteinG: d.proteinG, CarbsG: d.carbsG, FatG: d.fatG,
            });
        }));

    document.querySelectorAll('[data-recent]').forEach((btn) =>
        btn.addEventListener('click', () => {
            const d = JSON.parse(btn.dataset.recent);
            open('add', {
                Meal: f('Meal').value, Name: d.name, Brand: d.brand, ServingDescription: d.servingDescription,
                Servings: 1, Calories: d.calories, ProteinG: d.proteinG, CarbsG: d.carbsG, FatG: d.fatG,
            });
        }));

    if (modalEl.dataset.showOnLoad === 'true') {
        updateTotal();
        modal.show();
    }
})();
