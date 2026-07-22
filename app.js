document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('qualification-form');
    const steps = Array.from(document.querySelectorAll('.form-step:not(.success-message)'));
    const successMessage = document.getElementById('success-message');
    const nextBtns = document.querySelectorAll('.btn-next');
    const prevBtns = document.querySelectorAll('.btn-prev');
    const progressFill = document.getElementById('progress-fill');
    const stepCounter = document.getElementById('step-counter');
    
    let currentStepIndex = 0;

    // Initialize
    updateUI();

    // Next Button Click
    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentStepIndex)) {
                currentStepIndex++;
                updateUI();
            } else {
                // Shake effect or simple alert for invalid inputs
                const currentStepEl = steps[currentStepIndex];
                currentStepEl.classList.add('shake');
                setTimeout(() => currentStepEl.classList.remove('shake'), 500);
            }
        });
    });

    // Previous Button Click
    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentStepIndex--;
            updateUI();
        });
    });

    // Auto-avanço para opções de múltipla escolha (Radios)
    const radios = form.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
        // Usamos 'click' em vez de 'change' para permitir avanço ao clicar em opção já selecionada
        radio.addEventListener('click', () => {
            setTimeout(() => {
                if (validateStep(currentStepIndex)) {
                    currentStepIndex++;
                    updateUI();
                }
            }, 250); // Delay curto para o usuário ver o feedback visual da seleção
        });
    });

    // Form Submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validateStep(currentStepIndex)) {
            // Gather all data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Add non-form data elements like text inputs and textareas that don't have 'name' attr but have 'id'
            const inputs = form.querySelectorAll('input:not([type="radio"]), textarea');
            inputs.forEach(input => {
                if(input.id) {
                    data[input.id] = input.value;
                    formData.append(input.id, input.value);
                }
            });

            // --- Lógica de Rankeamento (Aquecimento x Investimento) ---
            let score = 0;
            let rank = '';
            
            // Pontos por Urgência (Aquecimento)
            if (data.urgencia === 'alta') score += 5;
            if (data.urgencia === 'media') score += 3;
            if (data.urgencia === 'baixa') score += 1;

            // Pontos por Orçamento (Investimento)
            if (data.orcamento === '5000+') score += 5;
            if (data.orcamento === '3000-5000') score += 3;
            if (data.orcamento === '1000-3000') score += 1;

            // Define a Classificação Final
            if (score >= 8) rank = '🔥 Quente (Alta Prioridade)';
            else if (score >= 5) rank = '🟡 Morno (Média Prioridade)';
            else rank = '🧊 Frio (Baixa Prioridade)';

            formData.append('Classificacao', rank);
            formData.append('Pontuacao', score);
            formData.append('Data', new Date().toLocaleString('pt-BR'));
            
            console.log("Lead Rankeado:", rank, "| Score:", score);

            const submitBtn = form.querySelector('.btn-submit');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Enviando...';
            submitBtn.disabled = true;

            // URL do seu Script do Google (Você precisa colar aqui o link gerado pelo Google)
            const scriptURL = 'https://script.google.com/macros/s/AKfycbw832rVyKU63kTYMgZJ8_NmQCOB8OWvGeEy1EugvN55OD04FuhTa7AtD6oXefOT8Xm4aQ/exec';

            // Se ainda não colocou o link, simula o envio para não travar:
            if (scriptURL === 'COLE_AQUI_SUA_URL_DO_GOOGLE_SCRIPT') {
                setTimeout(() => showSuccess(data, rank), 1500);
            } else {
                // Envia para a planilha
                fetch(scriptURL, { method: 'POST', body: formData })
                    .then(response => showSuccess(data, rank))
                    .catch(error => {
                        console.error('Erro ao enviar!', error.message);
                        submitBtn.innerHTML = 'Erro! Tentar novamente';
                        submitBtn.disabled = false;
                    });
            }

            // Função SHA-256 para criptografia exigida pelo Meta CAPI
            async function sha256(message) {
                const msgBuffer = new TextEncoder().encode(message.trim().toLowerCase());
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }

            // Função para enviar evento de Lead via Conversions API (CAPI) do Meta
            async function sendMetaCAPI(email, phone) {
                const pixelId = '1723469352297144'; // IMPORTANTE: Substitua pelo ID do seu Pixel do Meta
                const accessToken = 'EAApr1THuJjgBSHxAPYO9qSEgM5B3C9ZAwdbwJnMFFTPXDy8RQbzeaICesmLWjYZCUilYF3zHgujjAnSeQwGPCc0AyC3k7zNRVGqDZBQmmu8ncRzMGhO8f2db6BZBAN5gHrYZCNkRJ8Sn8ZCC9aafenYqm1Ajq3KsImb0VXB2gaQr1ZByXQiA4zQMBum6yobfgZDZD';

                if (pixelId === 'INSIRA_SEU_PIXEL_ID_AQUI' || !pixelId) {
                    console.warn('Meta CAPI: Pixel ID não configurado. Evento de CAPI ignorado.');
                    return;
                }

                try {
                    const hashedEmail = email ? await sha256(email) : null;
                    const hashedPhone = phone ? await sha256(phone.replace(/\D/g, '')) : null;

                    const payload = {
                        data: [{
                            event_name: 'Lead',
                            event_time: Math.floor(Date.now() / 1000),
                            action_source: 'website',
                            event_source_url: window.location.href,
                            user_data: {
                                em: hashedEmail ? [hashedEmail] : [],
                                ph: hashedPhone ? [hashedPhone] : []
                            }
                        }]
                    };

                    await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    console.log('Meta CAPI: Evento de Lead enviado com sucesso via API!');
                } catch (error) {
                    console.error('Meta CAPI: Erro ao enviar API de Conversões:', error);
                }
            }

            async function showSuccess(leadData, leadRank) {
                steps.forEach(step => step.classList.remove('active'));
                successMessage.classList.add('active');
                document.querySelector('.form-header').style.display = 'none';

                // Só dispara conversão no Meta Ads se o Lead for QUENTE (High Intent & High Budget)
                if (leadRank === '🔥 Quente (Alta Prioridade)') {
                    // 1. Dispara a conversão de Lead no Meta Pixel (Navegador)
                    if (typeof fbq === 'function') {
                        fbq('track', 'Lead');
                        console.log('Meta Pixel: Lead Quente Tracked successfully!');
                    }

                    // 2. Dispara a conversão de Lead na API de Conversões (Servidor/CAPI)
                    if (leadData) {
                        await sendMetaCAPI(leadData.email, leadData.telefone);
                    }
                } else {
                    console.log(`Meta Ads Tracking: Lead classificado como ${leadRank}. Evento de conversão ignorado.`);
                }
            }
        }
    });

    // Update UI (Progress, Steps, Counter)
    function updateUI() {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === currentStepIndex);
        });

        const stepNum = currentStepIndex + 1;
        const totalSteps = steps.length;
        
        stepCounter.textContent = `Etapa ${stepNum} de ${totalSteps}`;
        progressFill.style.width = `${(stepNum / totalSteps) * 100}%`;
    }

    // Validation
    function validateStep(index) {
        const step = steps[index];
        const inputs = step.querySelectorAll('input[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (input.type === 'radio') {
                const radioGroup = step.querySelectorAll(`input[name="${input.name}"]`);
                const isChecked = Array.from(radioGroup).some(radio => radio.checked);
                if (!isChecked) isValid = false;
            } else {
                if (!input.value.trim()) {
                    isValid = false;
                    input.style.borderColor = '#ff4444';
                    setTimeout(() => input.style.borderColor = '', 2000);
                }
            }
        });

        return isValid;
    }
});

// Add CSS Shake Animation dynamically
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
}
.shake {
    animation: shake 0.5s;
}
`;
document.head.appendChild(style);
