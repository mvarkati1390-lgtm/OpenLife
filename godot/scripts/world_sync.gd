extends Node

signal players_updated(players: Array)
signal sync_error(message: String)

var base_url := ""
var token := ""
var local_player: CharacterBody3D
var send_timer := 0.0
var receive_timer := 0.0
var sending := false
var receiving := false
var sender: HTTPRequest
var receiver: HTTPRequest

func _ready() -> void:
	sender = HTTPRequest.new()
	receiver = HTTPRequest.new()
	sender.timeout = 8.0
	receiver.timeout = 8.0
	add_child(sender)
	add_child(receiver)
	sender.request_completed.connect(_on_sender_request_completed)
	receiver.request_completed.connect(_on_receiver_request_completed)

func start(url: String, auth_token: String, player: CharacterBody3D) -> void:
	base_url = url.strip_edges().trim_suffix("/")
	token = auth_token
	local_player = player
	send_timer = 0.0
	receive_timer = 0.0

func stop() -> void:
	token = ""
	local_player = null

func _process(delta: float) -> void:
	if token.is_empty() or not is_instance_valid(local_player):
		return
	send_timer += delta
	receive_timer += delta
	if send_timer >= 0.9 and not sending:
		send_timer = 0.0
		_send_position()
	if receive_timer >= 2.0 and not receiving:
		receive_timer = 0.0
		_fetch_players()

func _send_position() -> void:
	var p := local_player.global_position
	var body := JSON.stringify({"x": p.x, "y": p.y, "z": p.z})
	sending = true
	var err := sender.request(base_url + "/api/world/position", _headers(), HTTPClient.METHOD_POST, body)
	if err != OK:
		sending = false
		sync_error.emit("ارسال موقعیت ناموفق بود.")

func _fetch_players() -> void:
	receiving = true
	var err := receiver.request(base_url + "/api/world/players", _headers(), HTTPClient.METHOD_GET)
	if err != OK:
		receiving = false
		sync_error.emit("دریافت بازیکنان ناموفق بود.")

func _headers() -> PackedStringArray:
	return PackedStringArray(["Content-Type: application/json", "Authorization: Bearer " + token])

func _on_sender_request_completed(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	sending = false
	if result != HTTPRequest.RESULT_SUCCESS:
		sync_error.emit("ارتباط با سرور قطع شد؛ موقعیت ارسال نشد.")
	elif code == 401:
		stop()
		sync_error.emit("نشست ورود منقضی شده؛ دوباره وارد شو.")
	elif code < 200 or code >= 300:
		var message := "سرور موقعیت را نپذیرفت: " + str(code)
		var parsed_error = JSON.parse_string(body.get_string_from_utf8())
		if parsed_error is Dictionary and parsed_error.has("error"):
			message = str(parsed_error.error)
		sync_error.emit(message)

func _on_receiver_request_completed(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	receiving = false
	if result != HTTPRequest.RESULT_SUCCESS:
		sync_error.emit("دریافت فهرست بازیکنان ناموفق بود؛ اتصال را بررسی کن.")
		return
	if code == 401:
		stop()
		sync_error.emit("نشست ورود منقضی شده؛ دوباره وارد شو.")
		return
	if code < 200 or code >= 300:
		sync_error.emit("سرور بازیکنان را ارسال نکرد: " + str(code))
		return
	var parsed = JSON.parse_string(body.get_string_from_utf8())
	if parsed is Dictionary and parsed.get("players") is Array:
		players_updated.emit(parsed.players)
	else:
		sync_error.emit("پاسخ فهرست بازیکنان نامعتبر است.")
