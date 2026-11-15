from flask import Flask, render_template_string, request, jsonify
import pandas as pd
import json
import os

app = Flask(__name__)

ROSTER_FILE = "roster.json"

DEFAULT_ROSTER = [
    {"number": "12", "name": "Rossi", "role": "Schiacciatore"},
    {"number": "40", "name": "Bianchi", "role": "Centrale"},
    {"number": "16", "name": "Verdi", "role": "Palleggiatore"},
    {"number": "33", "name": "Neri", "role": "Opposto"},
    {"number": "35", "name": "Russo", "role": "Schiacciatore"},
    {"number": "87", "name": "Gallo", "role": "Libero"},
    {"number": "43", "name": "Costa", "role": "Libero"},
    {"number": "39", "name": "Greco", "role": "Centrale"}
]

def load_roster():
    if os.path.exists(ROSTER_FILE):
        try:
            with open(ROSTER_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return list(DEFAULT_ROSTER)

def save_roster_to_disk(roster):
    with open(ROSTER_FILE, "w", encoding="utf-8") as f:
        json.dump(roster, f, indent=2, ensure_ascii=False)

data_store = {
    "roster": load_roster(),
    "lineup": {"P1": "12", "P6": "87", "P5": "40", "P4": "35", "P3": "16", "P2": "33"},
    "opp_lineup": {"P1": "1", "P6": "6", "P5": "5", "P4": "4", "P3": "3", "P2": "2"},
    "opp_mode": "semplificata",
    "current_rally": [],
    "score": {"noi": 0, "avversari": 0},
    "turn": "noi",
    "is_serve": True,
    "touch_count": 0,
    "last_player": None,
    "history": []
}

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(data_store)

@app.route('/api/opp-mode', methods=['POST'])
def set_opp_mode():
    data_store["opp_mode"] = request.json["mode"]
    return jsonify({"status": "ok"})

@app.route('/api/opp-jersey', methods=['POST'])
def set_opp_jersey():
    spot = request.json["spot"]
    num = request.json["num"]
    data_store["opp_lineup"][spot] = num
    return jsonify({"status": "ok"})

@app.route('/api/vote', methods=['POST'])
def register_vote():
    req = request.json
    team = req["team"]
    spot = req["spot"]
    player_id = req["player"]
    fund = req["fund"]
    vote = req["vote"]
    effect = req["effect"]

    prefix = "NOI" if team == "noi" else "AVV"
    lbl = f"[{prefix} {spot} #{player_id} {fund}:{vote}]" if (team == "noi" or data_store["opp_mode"] == "avanzata") else f"[{prefix} {spot} {fund}:{vote}]"

    data_store["current_rally"].append({
        "team": prefix,
        "spot": spot,
        "player": player_id,
        "foundational": fund,
        "vote": vote,
        "label": lbl
    })
    data_store["is_serve"] = False

    if effect == "win":
        winner = "noi" if team == "noi" else "avversari"
        data_store["score"][winner] += 1
        close_rally(f"Punto {winner.upper()}")
        start_new_rally(winner)
    elif effect == "lose":
        winner = "avversari" if team == "noi" else "noi"
        data_store["score"][winner] += 1
        close_rally(f"Punto {winner.upper()}")
        start_new_rally(winner)
    elif effect == "to_other":
        other = "avversari" if team == "noi" else "noi"
        if other == "avversari" and data_store["opp_mode"] == "skip":
            data_store["current_rally"].append({"team": "AVV", "spot": "-", "player": "-", "foundational": "Skip", "vote": "Palla Rigiocata", "label": "[AVV: Rigiocata]"})
            data_store["turn"] = "noi"
        else:
            data_store["turn"] = other
        data_store["touch_count"] = 0
        data_store["last_player"] = None
    elif effect == "block_touch":
        data_store["turn"] = team
        data_store["touch_count"] = 0
        data_store["last_player"] = None
    elif effect == "keep":
        data_store["turn"] = team
        data_store["touch_count"] += 1
        data_store["last_player"] = f"{team}_{spot}"

    return jsonify({"status": "ok"})

@app.route('/api/skip-opp', methods=['POST'])
def skip_opp():
    data_store["current_rally"].append({"team": "AVV", "spot": "-", "player": "-", "foundational": "Skip", "vote": "Palla Rigiocata", "label": "[AVV: Skip]"})
    data_store["turn"] = "noi"
    data_store["is_serve"] = False
    data_store["touch_count"] = 0
    data_store["last_player"] = None
    return jsonify({"status": "ok"})

@app.route('/api/ref-stop', methods=['POST'])
def ref_stop():
    winner = request.json["winner"].lower()
    data_store["score"][winner] += 1
    close_rally(f"Arbitro -> {winner.upper()}")
    start_new_rally(winner)
    return jsonify({"status": "ok"})

@app.route('/api/undo', methods=['POST'])
def undo():
    if data_store["current_rally"]:
        data_store["current_rally"].pop()
        if not data_store["current_rally"]:
            data_store["is_serve"] = True
            data_store["touch_count"] = 0
            data_store["last_player"] = None
        else:
            last = data_store["current_rally"][-1]
            data_store["turn"] = "noi" if last["team"] == "NOI" else "avversari"
            data_store["last_player"] = f"{data_store['turn']}_{last['spot']}" if last["spot"] != "-" else None
    return jsonify({"status": "ok"})

def start_new_rally(serving_team):
    data_store["turn"] = serving_team
    data_store["is_serve"] = True
    data_store["touch_count"] = 0
    data_store["last_player"] = None

def close_rally(result_str):
    for item in data_store["current_rally"]:
        rec = dict(item)
        rec["rally_result"] = result_str
        data_store["history"].append(rec)
    data_store["current_rally"] = []

@app.route('/api/rotate', methods=['POST'])
def rotate():
    team = request.json["team"]
    if team == "noi":
        l = data_store["lineup"]
        nl = {"P1": l["P2"], "P6": l["P1"], "P5": l["P6"], "P4": l["P5"], "P3": l["P4"], "P2": l["P3"]}
        if nl["P6"] in ["40", "39"]: nl["P6"] = "87"
        if nl["P5"] in ["40", "39"]: nl["P5"] = "43"
        if nl["P4"] == "87": nl["P4"] = "40"
        if nl["P4"] == "43": nl["P4"] = "39"
        data_store["lineup"] = nl
    else:
        l = data_store["opp_lineup"]
        data_store["opp_lineup"] = {"P1": l["P2"], "P6": l["P1"], "P5": l["P6"], "P4": l["P5"], "P3": l["P4"], "P2": l["P3"]}
    data_store["last_player"] = None
    return jsonify({"status": "ok"})

@app.route('/api/sub', methods=['POST'])
def sub():
    data_store["lineup"][request.json["spot"]] = request.json["bench_num"]
    data_store["last_player"] = None
    return jsonify({"status": "ok"})

@app.route('/api/roster/add', methods=['POST'])
def add_roster():
    req = request.json
    if not any(p["number"] == req["number"] for p in data_store["roster"]):
        data_store["roster"].append(req)
        save_roster_to_disk(data_store["roster"])
    return jsonify({"status": "ok"})

@app.route('/api/roster/remove', methods=['POST'])
def remove_roster():
    num = request.json["number"]
    data_store["roster"] = [p for p in data_store["roster"] if p["number"] != num]
    save_roster_to_disk(data_store["roster"])
    return jsonify({"status": "ok"})

@app.route('/api/export', methods=['GET'])
def export_excel():
    if not data_store["history"]:
        return jsonify({"msg": "Nessun dato registrato nei rally!"})
    df_all = pd.DataFrame(data_store["history"])

    stats_noi = []
    for p in data_store["roster"]:
        ph = [h for h in data_store["history"] if h["team"] == "NOI" and h["player"] == p["number"]]
        if ph:
            tot = len(ph)
            pts = len([h for h in ph if h["vote"] in ["Ace", "Vincente", "Muro Vincente"]])
            err = len([h for h in ph if "Fail" in h["vote"]])
            stats_noi.append({"Maglia": p["number"], "Nome": p["name"], "Ruolo": p["role"], "Tocchi": tot, "Punti": pts, "Errori": err, "Efficacia %": round(((pts - err) / tot) * 100, 1)})

    stats_avv = []
    opp_players = set([h["player"] for h in data_store["history"] if h["team"] == "AVV" and h["player"] != "-"])
    for op in sorted(opp_players):
        ph = [h for h in data_store["history"] if h["team"] == "AVV" and h["player"] == op]
        tot = len(ph)
        pts = len([h for h in ph if h["vote"] in ["Ace", "Vincente", "Muro Vincente"]])
        err = len([h for h in ph if "Fail" in h["vote"]])
        stats_avv.append({"Maglia Avv": op, "Tocchi": tot, "Punti": pts, "Errori": err, "Efficacia %": round(((pts - err) / tot) * 100, 1)})
    filename = "scout_partita_completa.xlsx"
    with pd.ExcelWriter(filename, engine="openpyxl") as writer:
        pd.DataFrame(stats_noi).to_excel(writer, sheet_name="Statistiche Noi", index=False)
        if stats_avv:
            pd.DataFrame(stats_avv).to_excel(writer, sheet_name="Statistiche Avversari", index=False)
        df_all.to_excel(writer, sheet_name="Cronologia Rally", index=False)
    return jsonify({"msg": f"Esportato con successo in: {os.path.abspath(filename)}"})

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Scout Volley Master</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; background: #eef2f5; user-select: none; }
        .top-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; background: #2c3e50; color: white; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px; gap: 10px; }
        .mode-btn { padding: 7px 10px; border: 2px solid #95a5a6; background: #34495e; color: white; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px; }
        .mode-btn.active { border-color: #f1c40f; background: #f39c12; color: #2c3e50; }
        .banner-turn { padding: 12px; border-radius: 6px; color: white; font-weight: bold; font-size: 17px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .turn-noi { background: #1e6091; }
        .turn-avv { background: #c0392b; }
        .rally-bar { background: #34495e; color: #ecf0f1; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
        .main-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 15px; }
        @media (max-width: 850px) { .main-grid { grid-template-columns: 1fr; } }
        .panel { background: white; padding: 14px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.08); }
        .court-box { border-radius: 6px; overflow: hidden; border: 2px solid #2c3e50; }
        .opp-court { background: #c0392b; padding: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .our-court { background: #2980b9; padding: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .net-divider { height: 8px; background: repeating-linear-gradient(90deg, #fff, #fff 10px, #2c3e50 10px, #2c3e50 20px); }
        .spot { background: #ffffff; padding: 10px 4px; text-align: center; border-radius: 5px; cursor: pointer; font-weight: bold; border: 3px solid transparent; font-size: 13px; }
        .spot.selected { border-color: #2ecc71; background: #e8f8f5; transform: scale(1.03); }
        .spot.locked { opacity: 0.4; cursor: not-allowed; background: #bdc3c7; }
        .spot.libero { background: #fef9e7; }
        .spot.opp-spot { background: #fadbd8; color: #78281f; }
        .spot.opp-spot.selected { border-color: #f1c40f; background: #fcf3cf; }
        .sub-lbl { font-size: 11px; display: block; margin-top: 2px; font-weight: normal; }
        .controls-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
        .btn-ctrl { padding: 9px 11px; border: none; border-radius: 5px; font-weight: bold; color: white; cursor: pointer; font-size: 12px; }
        .fund-section { margin-bottom: 9px; border-bottom: 1px solid #eee; padding-bottom: 7px; }
        .fund-section.disabled { opacity: 0.3; pointer-events: none; }
        .fund-title { font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 4px; text-transform: uppercase; }
        .voti-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
        .btn-v { padding: 9px 4px; border: none; border-radius: 5px; font-weight: bold; color: white; cursor: pointer; font-size: 12px; }
        .c-win { background: #27ae60; } .c-good { background: #2980b9; } .c-warn { background: #e67e22; } .c-err { background: #c0392b; }
        .bench-box { margin-top: 12px; background: #f8f9f9; padding: 10px; border-radius: 6px; border: 1px solid #d5dbdb; }
        .bench-item { display: inline-block; background: #34495e; color: white; padding: 5px 9px; margin: 3px; border-radius: 4px; font-size: 12px; cursor: pointer; }
        .roster-form { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
        .roster-form input, .roster-form select { padding: 6px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 12px; }
    </style>
</head>
<body>

<div class="top-bar">
    <div><strong>Modalità Avversario:</strong></div>
    <div>
        <button id="m-semplificata" class="mode-btn" onclick="setMode('semplificata')">Semplificata (Posizioni)</button>
        <button id="m-avanzata" class="mode-btn" onclick="setMode('avanzata')">Avanzata (Maglie + Stats)</button>
        <button id="m-skip" class="mode-btn" onclick="setMode('skip')">Salta Turno Avv (Veloce)</button>
    </div>
</div>

<div id="turn-banner" class="banner-turn turn-noi">
    <span id="turn-label">TURNO NOI</span>
    <span>NOI <strong id="score-noi">0</strong> - <strong id="score-avv">0</strong> AVV</span>
</div>

<div class="rally-bar">
    <div><strong>Rally:</strong> <span id="rally-seq">In attesa...</span></div>
    <div>
        <button id="btn-manual-skip" class="btn-ctrl" style="background:#7f8c8d; display:none;" onclick="skipOpp()">⏭ Salta Avv</button>
        <button class="btn-ctrl" style="background:#e67e22;" onclick="undoTouch()">↩ Annulla</button>
    </div>
</div>

<div class="main-grid">
    <div class="panel">
        <div class="court-box">
            <div id="opp-court-grid" class="opp-court">
                <div id="opp-P1" class="spot opp-spot" onclick="selectSpot('avversari','P1')">AVV P1<span id="lbl-opp-P1" class="sub-lbl">-</span></div>
                <div id="opp-P6" class="spot opp-spot" onclick="selectSpot('avversari','P6')">AVV P6<span id="lbl-opp-P6" class="sub-lbl">-</span></div>
                <div id="opp-P5" class="spot opp-spot" onclick="selectSpot('avversari','P5')">AVV P5<span id="lbl-opp-P5" class="sub-lbl">-</span></div>
                <div id="opp-P2" class="spot opp-spot" onclick="selectSpot('avversari','P2')">AVV P2<span id="lbl-opp-P2" class="sub-lbl">-</span></div>
                <div id="opp-P3" class="spot opp-spot" onclick="selectSpot('avversari','P3')">AVV P3<span id="lbl-opp-P3" class="sub-lbl">-</span></div>
                <div id="opp-P4" class="spot opp-spot" onclick="selectSpot('avversari','P4')">AVV P4<span id="lbl-opp-P4" class="sub-lbl">-</span></div>
            </div>
            <div class="net-divider"></div>
            <div class="our-court">
                <div id="noi-P4" class="spot" onclick="selectSpot('noi','P4')">P4<span id="lbl-noi-P4" class="sub-lbl">-</span></div>
                <div id="noi-P3" class="spot" onclick="selectSpot('noi','P3')">P3<span id="lbl-noi-P3" class="sub-lbl">-</span></div>
                <div id="noi-P2" class="spot" onclick="selectSpot('noi','P2')">P2<span id="lbl-noi-P2" class="sub-lbl">-</span></div>
                <div id="noi-P5" class="spot" onclick="selectSpot('noi','P5')">P5<span id="lbl-noi-P5" class="sub-lbl">-</span></div>
                <div id="noi-P6" class="spot" onclick="selectSpot('noi','P6')">P6<span id="lbl-noi-P6" class="sub-lbl">-</span></div>
                <div id="noi-P1" class="spot" onclick="selectSpot('noi','P1')">P1<span id="lbl-noi-P1" class="sub-lbl">-</span></div>
            </div>
        </div>

        <div class="controls-bar">
            <button class="btn-ctrl" style="background:#2980b9;" onclick="rotateLineup('noi')">🔄 Ruota Noi</button>
            <button id="btn-rot-avv" class="btn-ctrl" style="background:#c0392b;" onclick="rotateLineup('avversari')">🔄 Ruota Avv</button>
            <button class="btn-ctrl" style="background:#8e44ad;" onclick="refStop('Avversari')">⚠️ Fallo Arb (Avv)</button>
            <button class="btn-ctrl" style="background:#27ae60;" onclick="refStop('Noi')">🟢 Punto Arb (Noi)</button>
            <button class="btn-ctrl" style="background:#2c3e50;" onclick="exportExcel()">📊 Esporta Excel</button>
        </div>

        <div id="opp-jersey-editor" class="bench-box" style="display:none; background:#fdedec;">
            <div style="font-size:12px; font-weight:bold; color:#922b21;">MAGLIE AVVERSARI (Modalità Avanzata):</div>
            <div style="display:flex; gap:5px; margin-top:5px; flex-wrap:wrap;">
                <span>P1:<input id="oj-P1" style="width:30px" onchange="updOppJ('P1')"></span>
                <span>P2:<input id="oj-P2" style="width:30px" onchange="updOppJ('P2')"></span>
                <span>P3:<input id="oj-P3" style="width:30px" onchange="updOppJ('P3')"></span>
                <span>P4:<input id="oj-P4" style="width:30px" onchange="updOppJ('P4')"></span>
                <span>P5:<input id="oj-P5" style="width:30px" onchange="updOppJ('P5')"></span>
                <span>P6:<input id="oj-P6" style="width:30px" onchange="updOppJ('P6')"></span>
            </div>
        </div>

        <div class="bench-box">
            <div style="font-size:12px; font-weight:bold; color:#2c3e50;">PANCHINA NOI (Clicca posizione in campo, poi riserva):</div>
            <div id="bench-list" style="margin-top:4px;"></div>
            <div class="roster-form">
                <input type="text" id="new-num" placeholder="N°" style="width:40px;">
                <input type="text" id="new-name" placeholder="Nome" style="width:100px;">
                <select id="new-role">
                    <option value="Schiacciatore">Schiacciatore</option>
                    <option value="Centrale">Centrale</option>
                    <option value="Palleggiatore">Palleggiatore</option>
                    <option value="Opposto">Opposto</option>
                    <option value="Libero">Libero</option>
                </select>
                <button class="btn-ctrl" style="background:#27ae60; padding:6px 10px;" onclick="addRoster()">+ Aggiungi</button>
            </div>
            <div id="full-roster-del" style="margin-top:6px; font-size:11px;"></div>
        </div>
    </div>

    <div class="panel">
        <h3 style="margin-top:0; font-size:16px;">Azione: <span id="active-title" style="color:#2980b9;">-</span></h3>
        <div id="voti-wrapper">
                <span>P2:<input id="oj-P2" style="width:30px" onchange="updOppJ('P2')"></span>
                <span>P3:<input id="oj-P3" style="width:30px" onchange="updOppJ('P3')"></span>
                <span>P4:<input id="oj-P4" style="width:30px" onchange="updOppJ('P4')"></span>
                <span>P5:<input id="oj-P5" style="width:30px" onchange="updOppJ('P5')"></span>
                <span>P6:<input id="oj-P6" style="width:30px" onchange="updOppJ('P6')"></span>
            </div>
        </div>

        <div class="bench-box">
            <div style="font-size:12px; font-weight:bold; color:#2c3e50;">PANCHINA NOI (Clicca posizione in campo, poi riserva):</div>
            <div id="bench-list" style="margin-top:4px;"></div>
            <div class="roster-form">
                <input type="text" id="new-num" placeholder="N°" style="width:40px;">
                <input type="text" id="new-name" placeholder="Nome" style="width:100px;">
                <select id="new-role">
                    <option value="Schiacciatore">Schiacciatore</option>
                    <option value="Centrale">Centrale</option>
                    <option value="Palleggiatore">Palleggiatore</option>
                    <option value="Opposto">Opposto</option>
                    <option value="Libero">Libero</option>
                </select>
                <button class="btn-ctrl" style="background:#27ae60; padding:6px 10px;" onclick="addRoster()">+ Aggiungi</button>
            </div>
            <div id="full-roster-del" style="margin-top:6px; font-size:11px;"></div>
        </div>
    </div>

    <div class="panel">
        <h3 style="margin-top:0; font-size:16px;">Azione: <span id="active-title" style="color:#2980b9;">-</span></h3>
        <div id="voti-wrapper">
            <div id="sec-serve" class="fund-section">
                <div class="fund-title">1. Battuta (Solo P1 ad inizio scambio)</div>
                <div class="voti-grid">
                    <button class="btn-v c-win" onclick="sendVote('Serve','Ace','win')">Ace</button>
                    <button class="btn-v c-good" onclick="sendVote('Serve','Good','to_other')">Good</button>
                    <button class="btn-v c-warn" onclick="sendVote('Serve','Ok','to_other')">Ok</button>
                    <button class="btn-v c-err" onclick="sendVote('Serve','Fail','lose')">Fail</button>
                </div>
            </div>
            <div id="sec-spike" class="fund-section">
                <div class="fund-title">2. Attacco (Spike)</div>
                <div class="voti-grid">
                    <button class="btn-v c-win" onclick="sendVote('Spike','Vincente','win')">Vincente</button>
                    <button class="btn-v c-good" onclick="sendVote('Spike','Well Placed','to_other')">Well Placed</button>
                    <button class="btn-v c-good" onclick="sendVote('Spike','Good','to_other')">Good</button>
                    <button class="btn-v c-warn" onclick="sendVote('Spike','Difeso 2a Linea','to_other')">Difeso 2a Linea</button>
                    <button class="btn-v c-warn" onclick="sendVote('Spike','Murato/Coperto','keep')">Murato/Coperto</button>
                    <button class="btn-v c-err" onclick="sendVote('Spike','Fail Out','lose')">Fail (Out)</button>
                    <button class="btn-v c-err" onclick="sendVote('Spike','Fail Rete','lose')">Fail (Rete)</button>
                </div>
            </div>
            <div id="sec-block" class="fund-section">
                <div class="fund-title">3. Muro (Block)</div>
                <div class="voti-grid">
                    <button class="btn-v c-win" onclick="sendVote('Block','Muro Vincente','win')">Muro Vincente</button>
                    <button class="btn-v c-good" onclick="sendVote('Block','Tocco','block_touch')">Tocco (4° Tocco)</button>
                    <button class="btn-v c-warn" onclick="sendVote('Block','Interdict Area','keep')">Interdict Area</button>
                    <button class="btn-v c-warn" onclick="sendVote('Block','No Block','keep')">No Block</button>
                </div>
            </div>
            <div id="sec-dig" class="fund-section">
                <div class="fund-title">4. Ricezione (Dig)</div>
                <div class="voti-grid">
                    <button class="btn-v c-good" onclick="sendVote('Dig','Perfetta (Ric+)','keep')">Perfetta (Ric+)</button>
                    <button class="btn-v c-good" onclick="sendVote('Dig','Good','keep')">Good</button>
                    <button class="btn-v c-warn" onclick="sendVote('Dig','Bad','keep')">Bad</button>
                    <button class="btn-v c-warn" onclick="sendVote('Dig','Freeball','to_other')">Freeball</button>
                    <button class="btn-v c-err" onclick="sendVote('Dig','Fail','lose')">Fail</button>
                </div>
            </div>
            <div id="sec-def" class="fund-section">
                <div class="fund-title">5. Difesa (Defense)</div>
                <div class="voti-grid">
                    <button class="btn-v c-good" onclick="sendVote('Defense','Perfetta (+)','keep')">Perfetta (+)</button>
                    <button class="btn-v c-good" onclick="sendVote('Defense','Good','keep')">Good</button>
                    <button class="btn-v c-warn" onclick="sendVote('Defense','Bad','keep')">Bad</button>
                    <button class="btn-v c-warn" onclick="sendVote('Defense','Freeball','to_other')">Freeball</button>
                    <button class="btn-v c-err" onclick="sendVote('Defense','Fail','lose')">Fail</button>
                </div>
            </div>
            <div id="sec-set" class="fund-section" style="border-bottom:none;">
                <div class="fund-title">6. Alzata (Set)</div>
                <div class="voti-grid">
                    <button class="btn-v c-good" onclick="sendVote('Set','Perfetta (Optimal)','keep')">Perfetta (Optimal)</button>
                    <button class="btn-v c-good" onclick="sendVote('Set','Good','keep')">Good</button>
                    <button class="btn-v c-warn" onclick="sendVote('Set','Bad','keep')">Bad</button>
                    <button class="btn-v c-warn" onclick="sendVote('Set','Freeball','to_other')">Freeball</button>
                    <button class="btn-v c-err" onclick="sendVote('Set','Fail','lose')">Fail</button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    let state = {};
    let selTeam = null;
    let selSpot = null;

    function fetchState() {
        fetch('/api/state').then(r => r.json()).then(data => {
            state = data;
            if (state.is_serve) {
                selTeam = state.turn;
                selSpot = 'P1';
            }
            renderUI();
        });
    }

    function renderUI() {
        document.getElementById('score-noi').innerText = state.score.noi;
        document.getElementById('score-avv').innerText = state.score.avversari;

        ['semplificata', 'avanzata', 'skip'].forEach(m => {
            document.getElementById(`m-${m}`).classList.toggle('active', state.opp_mode === m);
        });
        document.getElementById('opp-jersey-editor').style.display = state.opp_mode === 'avanzata' ? 'block' : 'none';
        document.getElementById('opp-court-grid').style.opacity = state.opp_mode === 'skip' ? '0.35' : '1';
        document.getElementById('btn-manual-skip').style.display = (state.turn === 'avversari' && state.opp_mode !== 'skip') ? 'inline-block' : 'none';

        const banner = document.getElementById('turn-banner');
        const label = document.getElementById('turn-label');
        if (state.turn === 'noi') {
            banner.className = 'banner-turn turn-noi';
            label.innerText = state.is_serve ? 'BATTUTA NOI (Obbligatoria P1)' : `TURNO NOI — Tocchi: ${state.touch_count}/3`;
        } else {
            banner.className = 'banner-turn turn-avv';
            label.innerText = state.is_serve ? 'BATTUTA AVVERSARI (P1 o Skip)' : `TURNO AVVERSARI — Tocchi: ${state.touch_count}/3`;
        }

        document.getElementById('rally-seq').innerText = state.current_rally.map(i => i.label).join(' ➔ ') || 'In attesa...';

        const onCourt = Object.values(state.lineup);
        for (let s in state.lineup) {
            const num = state.lineup[s];
            const p = state.roster.find(x => x.number === num);
            const el = document.getElementById(`noi-${s}`);
            document.getElementById(`lbl-noi-${s}`).innerText = p ? `#${p.number} ${p.name}` : 'Vuoto';
            el.classList.remove('selected', 'locked', 'libero');
            if (p && p.role === 'Libero') el.classList.add('libero');
            if (state.last_player === `noi_${s}` || (state.is_serve && (state.turn !== 'noi' || s !== 'P1'))) el.classList.add('locked');
            if (selTeam === 'noi' && selSpot === s) el.classList.add('selected');
        }

        for (let s in state.opp_lineup) {
            const num = state.opp_lineup[s];
            const el = document.getElementById(`opp-${s}`);
            document.getElementById(`oj-${s}`).value = num;
            document.getElementById(`lbl-opp-${s}`).innerText = state.opp_mode === 'avanzata' ? `Maglia #${num}` : `Zona ${s}`;
            el.classList.remove('selected', 'locked');
            if (state.opp_mode === 'skip' || state.last_player === `avversari_${s}` || (state.is_serve && (state.turn !== 'avversari' || s !== 'P1'))) {
                el.classList.add('locked');
            }
            if (selTeam === 'avversari' && selSpot === s) el.classList.add('selected');
        }

        const benchDiv = document.getElementById('bench-list');
        benchDiv.innerHTML = '';
        state.roster.forEach(p => {
            if (!onCourt.includes(p.number)) {
                benchDiv.innerHTML += `<span class="bench-item" onclick="subPlayer('${p.number}')">🔄 #${p.number} ${p.name}</span>`;
            }
        });

        const delDiv = document.getElementById('full-roster-del');
        delDiv.innerHTML = 'Rimuovi: ';
        state.roster.forEach(p => {
            delDiv.innerHTML += `<button style="margin:2px; font-size:11px;" onclick="removeRoster('${p.number}')">❌ #${p.number}</button>`;
        });

        const wrap = document.getElementById('voti-wrapper');
        if (selTeam && selSpot) {
            const pId = selTeam === 'noi' ? `#${state.lineup[selSpot]}` : (state.opp_mode === 'avanzata' ? `#${state.opp_lineup[selSpot]}` : selSpot);
            document.getElementById('active-title').innerText = `${selTeam.toUpperCase()} - ${pId}`;
            wrap.style.opacity = '1';
            wrap.style.pointerEvents = 'auto';

            document.getElementById('sec-serve').classList.toggle('disabled', !state.is_serve);
            ['sec-spike', 'sec-block', 'sec-dig', 'sec-def', 'sec-set'].forEach(id => {
                document.getElementById(id).classList.toggle('disabled', state.is_serve);
            });
        } else {
            document.getElementById('active-title').innerText = 'Seleziona un giocatore';
            wrap.style.opacity = '0.35';
            wrap.style.pointerEvents = 'none';
        }
    }

    function selectSpot(team, spot) {
        if (team === 'avversari' && state.opp_mode === 'skip') return;
        if (state.is_serve && (team !== state.turn || spot !== 'P1')) {
            alert("Ad inizio scambio la battuta spetta obbligatoriamente al giocatore in P1!");
            return;
        }
        if (state.last_player === `${team}_${spot}`) {
            alert("Fallo di doppio tocco! Seleziona un altro giocatore.");
            return;
        }
        selTeam = team;
        selSpot = spot;
        renderUI();
    }

    function sendVote(fund, vote, effect) {
        if (!selTeam || !selSpot) return;
        const pId = selTeam === 'noi' ? state.lineup[selSpot] : state.opp_lineup[selSpot];
        fetch('/api/vote', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ team: selTeam, spot: selSpot, player: pId, fund: fund, vote: vote, effect: effect })
        }).then(() => {
            selTeam = null;
            selSpot = null;
            fetchState();
        });
    }

    function setMode(m) { fetch('/api/opp-mode', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mode: m }) }).then(() => fetchState()); }
    function updOppJ(s) { const val = document.getElementById(`oj-${s}`).value; fetch('/api/opp-jersey', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ spot: s, num: val }) }).then(() => fetchState()); }
    function skipOpp() { fetch('/api/skip-opp', { method: 'POST' }).then(() => { selTeam = null; selSpot = null; fetchState(); }); }
    function undoTouch() { fetch('/api/undo', { method: 'POST' }).then(() => { selTeam = null; selSpot = null; fetchState(); }); }
    function rotateLineup(t) { fetch('/api/rotate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ team: t }) }).then(() => { selTeam = null; selSpot = null; fetchState(); }); }
    function refStop(w) { fetch('/api/ref-stop', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ winner: w }) }).then(() => { selTeam = null; selSpot = null; fetchState(); }); }
    function subPlayer(bNum) {
        if (selTeam !== 'noi' || !selSpot) { alert("Clicca prima sulla nostra posizione in campo da sostituire!"); return; }
        fetch('/api/sub', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ spot: selSpot, bench_num: bNum }) }).then(() => { selTeam = null; selSpot = null; fetchState(); });
    }
    function addRoster() {
        const num = document.getElementById('new-num').value.trim();
        const name = document.getElementById('new-name').value.trim();
        const role = document.getElementById('new-role').value;
        if (!num || !name) return;
        fetch('/api/roster/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ number: num, name: name, role: role }) }).then(() => { document.getElementById('new-num').value = ''; document.getElementById('new-name').value = ''; fetchState(); });
    }
    function removeRoster(num) { fetch('/api/roster/remove', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ number: num }) }).then(() => fetchState()); }
    function exportExcel() { fetch('/api/export').then(r => r.json()).then(d => alert(d.msg)); }

    fetchState();
</script>
</body>
</html>"""

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
