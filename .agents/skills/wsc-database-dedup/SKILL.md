---
name: wsc-database-dedup
description: Use esta skill ao criar modelos de banco de dados SQLAlchemy/SQLite, lógica de validação de estatísticas do jogador ou serviços de monitoramento contínuo com deduplicação de estado.
---

# Modelagem de Dados e Deduplicação de Estado

## Modelagem SQLite (`models.py`)
1. `CareerProfile`: `id`, `player_name`, `nationality`, `position`, `target_window_title`, `created_at`.
2. `SeasonLog`: `id`, `career_id`, `season_number`, `club_name`, `age`, `overall`, `matches`, `goals`, `assists`, `trophies_count`, `updated_at`.
3. `EvolutionEvent`: `id`, `career_id`, `event_type` ("GOAL", "ASSIST", "OVR_UP", "TRANSFER"), `old_value`, `new_value`, `timestamp`.

## Lógica de Deduplicação (Anti-Spam)
- Mantenha o "Último Estado Conhecido" em memória RAM (`last_known_state`).
- Só execute `db.commit()` e só emita mensagem no WebSocket se `novo_estado != last_known_state`.
- Valide outliers: O Overall de um jogador no WSC está sempre entre `30` e `99`, e a Idade entre `15` e `45`. Descarte leituras de OCR que fujam dessas regras.
