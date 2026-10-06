-- Progreso de cada juego por jugador (estrellas, récords, cuentas difíciles).
-- Una fila por jugador y juego; el servidor la reemplaza entera en cada guardado.
CREATE TABLE IF NOT EXISTS progreso (
  jugador_id integer NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  app        text    NOT NULL,
  datos      jsonb   NOT NULL,
  t          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jugador_id, app)
);
