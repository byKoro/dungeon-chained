import React from "react";
import { AbsoluteFill } from "remotion";
import { WIDTH, HEIGHT } from "../theme";

// Câmera 2D: define o ponto do MUNDO que fica no centro da tela e um zoom.
// Tudo dentro vive em coordenadas de mundo (px, com TILE=64 como no jogo).
// Assim personagens e sala compartilham o mesmo espaço e mover a câmera
// (pan/zoom) dá o movimento de câmera que falta.
export const Camera: React.FC<{
  x: number; // ponto do mundo no centro da tela (px)
  y: number;
  zoom: number; // 1 = 1 px de mundo -> 1 px de tela
  shake?: string; // translate opcional (screen shake)
  children: React.ReactNode;
}> = ({ x, y, zoom, shake = "0px 0px", children }) => {
  // Mapeia mundo -> tela: o ponto (x,y) do mundo deve cair no centro da tela,
  // com `zoom` aplicado. Para um filho em (wx,wy): screen = center + (w - cam)*zoom.
  // Compomos como translate(center) -> scale(zoom) -> translate(-cam), lendo da
  // direita para a esquerda, com transform-origin no canto (0,0).
  return (
    <AbsoluteFill style={{ overflow: "hidden", translate: shake }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: WIDTH,
          height: HEIGHT,
          transform: `translate(${WIDTH / 2}px, ${HEIGHT / 2}px) scale(${zoom}) translate(${-x}px, ${-y}px)`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
