import { useState, useEffect } from 'preact/hooks';
import { detectEnv, installAdvice } from './lib/install.js';
import { canPrompt, onPromptChange, promptInstall } from './lib/install-prompt.js';
import { isStandalone } from './lib/push.js';

// Orientação de instalação adaptada ao aparelho — inclusive quando a pessoa chega pelo Instagram/Facebook.
export function InstallGuide() {
  const [, tick] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => onPromptChange(() => tick((n) => n + 1)), []);
  const advice = installAdvice(detectEnv(navigator.userAgent, isStandalone()), canPrompt());

  const copyLink = async () => { try { await navigator.clipboard.writeText(location.origin + '/app/'); setCopied(true); } catch {} };

  return (
    <div class="install" data-advice={advice}>
      {advice === 'installed' && <p role="status">✓ O Rotininha já está instalado neste aparelho.</p>}
      {advice === 'in-app' && (
        <>
          <p><strong>Você está dentro de outro app (Instagram, Facebook…).</strong> Para instalar, abra no navegador do celular:</p>
          <ol>
            <li>Toque nos três pontinhos <strong>⋯</strong> (ou no ícone de compartilhar) no canto da tela.</li>
            <li>Escolha <strong>“Abrir no navegador”</strong> (Safari ou Chrome).</li>
            <li>Depois, siga as instruções de instalação que vão aparecer lá.</li>
          </ol>
          <button class="btn ghost" onClick={copyLink}>{copied ? 'Link copiado!' : 'Copiar link para colar no navegador'}</button>
        </>
      )}
      {advice === 'ios-safari' && (
        <ol>
          <li>Toque em <strong>Compartilhar</strong> <span aria-hidden="true">⬆️</span> na barra do Safari.</li>
          <li>Role e toque em <strong>“Adicionar à Tela de Início”</strong>.</li>
          <li>Abra o Rotininha <strong>pelo ícone</strong> da tela inicial — é assim que os lembretes funcionam no iPhone.</li>
        </ol>
      )}
      {advice === 'ios-other' && <p>No iPhone, abra este endereço no <strong>Safari</strong> e use Compartilhar → <strong>Adicionar à Tela de Início</strong>. É o que permite receber lembretes.</p>}
      {advice === 'android-prompt' && <button class="btn" onClick={promptInstall}>Instalar o Rotininha</button>}
      {advice === 'android-menu' && <p>Toque no menu <strong>⋮</strong> do navegador e escolha <strong>“Instalar app”</strong> (ou “Adicionar à tela inicial”).</p>}
      {advice === 'desktop' && <p>No computador, use o ícone de instalar na barra de endereço do navegador. O Rotininha é pensado para o celular.</p>}
    </div>
  );
}
