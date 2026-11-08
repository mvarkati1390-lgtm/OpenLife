extends Node

signal status_changed(message: String)
signal authenticated(user: Dictionary)

var base_url := ""
var token := ""
var http: HTTPRequest

func _ready() -> void:
	http = HTTPRequest.new()
	http.timeout = 15.0
	add_child(http)

func configure(url: String) -> void:
	base_url = url.strip_edges().trim_suffix("/")

func login(username: String, password: String) -> void:
	_send_auth("/api/login", username, password)

func register_user(username: String, password: String) -> void:
	_send_auth("/api/register", username, password)

func _send_auth(path: String, username: String, password: String) -> void:
	if not base_url.begins_with("https://"):
		status_changed.emit("آدرس سرور باید با https:// شروع شود.")
		return
	if username.strip_edges().is_empty() or password.is_empty():
		status_changed.emit("نام کاربری و رمز را وارد کن.")
		return
	var body := JSON.stringify({"username": username.strip_edges(), "password": password})
	var headers := PackedStringArray(["Content-Type: application/json"])
	var err := http.request(base_url + path, headers, HTTPClient.METHOD_POST, body)
	if err != OK:
		status_changed.emit("ارسال درخواست ممکن نشد: " + str(err))
		return
	var result: Array = await http.request_completed
	var response_code: int = result[1]
	var response_text := (result[3] as PackedByteArray).get_string_from_utf8()
	var parsed = JSON.parse_string(response_text)
	if response_code < 200 or response_code >= 300:
		var message := "خطای سرور: " + str(response_code)
		if parsed is Dictionary and parsed.has("error"):
			message = str(parsed.error)
		status_changed.emit(message)
		return
	if parsed is Dictionary and parsed.has("token"):
		token = str(parsed.token)
		var user: Dictionary = parsed.get("user", {})
		authenticated.emit(user)
		status_changed.emit("ورود موفق بود؛ اتصال به دنیای آنلاین برقرار شد.")
	else:
		status_changed.emit("پاسخ سرور قابل شناسایی نیست.")
