export class DemoVictory {
    constructor({ onRestart }) {
        this.element = document.createElement('section');
        this.element.className = 'demo-victory'; this.element.hidden = true;
        this.element.innerHTML = '<div><h1>Obrigado por jogar!</h1><p>Vocês venceram a Caveira de Fogo.</p><p>Dungeon Chained — Demo</p><button>Jogar novamente</button></div>';
        const button = this.element.querySelector('button');
        button.onclick = () => { this.hide(); onRestart(); };
        document.body.append(this.element);
    }
    show() { this.element.hidden = false; this.element.querySelector('button').focus(); }
    hide() { this.element.hidden = true; }
}
