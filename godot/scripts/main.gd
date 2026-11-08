extends Node3D

const PLAYER_SCRIPT = preload("res://scripts/player.gd")
const API_SCRIPT = preload("res://scripts/openlife_api.gd")

var player: CharacterBody3D
var api: Node
var status_label: Label
var server_input: LineEdit
var username_input: LineEdit
var password_input: LineEdit

func _ready() -> void:
	_build_world()
	_build_player()
	_build_ui()
	api = API_SCRIPT.new()
	add_child(api)
	api.status_changed.connect(_on_api_status)

func _build_world() -> void:
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = Sky.new()
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.72, 0.85)
	env.ambient_light_energy = 0.8
	environment.environment = env
	add_child(environment)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -25, 0)
	sun.light_energy = 1.2
	add_child(sun)

	var ground := StaticBody3D.new()
	ground.name = "Ground"
	var ground_mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(180, 180)
	ground_mesh.mesh = plane
	var ground_mat := StandardMaterial3D.new()
	ground_mat.albedo_color = Color(0.72, 0.68, 0.48)
	ground_mat.roughness = 1.0
	ground_mesh.material_override = ground_mat
	ground.add_child(ground_mesh)
	var ground_shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(180, 0.5, 180)
	ground_shape.shape = box
	ground_shape.position.y = -0.25
	ground.add_child(ground_shape)
	add_child(ground)

	for i in range(12):
		var block := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(2.5, randf_range(1.5, 5.0), 2.5)
		block.mesh = mesh
		block.position = Vector3(randf_range(-28, 28), mesh.size.y / 2.0, randf_range(-28, 28))
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.78, 0.76, 0.68)
		block.material_override = mat
		add_child(block)

func _build_player() -> void:
	player = PLAYER_SCRIPT.new()
	player.position = Vector3(0, 1, 0)
	add_child(player)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var panel := PanelContainer.new()
	panel.position = Vector2(16, 16)
	panel.custom_minimum_size = Vector2(300, 0)
	layer.add_child(panel)
	var column := VBoxContainer.new()
	panel.add_child(column)

	var heading := Label.new()
	heading.text = "OpenLife | نسخه آزمایشی"
	column.add_child(heading)

	server_input = LineEdit.new()
	server_input.placeholder_text = "آدرس سرور HTTPS"
	server_input.text = "https://YOUR-SERVER.example"
	column.add_child(server_input)

	username_input = LineEdit.new()
	username_input.placeholder_text = "نام کاربری"
	column.add_child(username_input)

	password_input = LineEdit.new()
	password_input.placeholder_text = "رمز عبور"
	password_input.secret = true
	column.add_child(password_input)

	var buttons := HBoxContainer.new()
	column.add_child(buttons)
	var login := Button.new()
	login.text = "ورود"
	login.pressed.connect(_login)
	buttons.add_child(login)
	var register := Button.new()
	register.text = "ثبت‌نام"
	register.pressed.connect(_register)
	buttons.add_child(register)

	status_label = Label.new()
	status_label.text = "برای حرکت از WASD یا کلیدهای جهت استفاده کن."
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(status_label)

func _login() -> void:
	api.configure(server_input.text)
	api.login(username_input.text, password_input.text)

func _register() -> void:
	api.configure(server_input.text)
	api.register_user(username_input.text, password_input.text)

func _on_api_status(message: String) -> void:
	if is_instance_valid(status_label):
		status_label.text = message
