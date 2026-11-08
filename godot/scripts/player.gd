extends CharacterBody3D

const SPEED := 7.0
const JUMP_VELOCITY := 4.5
var gravity := 18.0
var camera_pivot: Node3D

func _ready() -> void:
	var capsule := CapsuleMesh.new()
	capsule.radius = 0.42
	capsule.height = 1.8
	var visual := MeshInstance3D.new()
	visual.mesh = capsule
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.12, 0.42, 0.72)
	visual.material_override = material
	visual.position.y = 0.9
	add_child(visual)

	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.42
	shape.height = 1.8
	collision.shape = shape
	collision.position.y = 0.9
	add_child(collision)

	camera_pivot = Node3D.new()
	camera_pivot.position = Vector3(0, 1.5, 0)
	add_child(camera_pivot)
	var arm := SpringArm3D.new()
	arm.spring_length = 6.0
	arm.rotation_degrees.x = -12
	camera_pivot.add_child(arm)
	var camera := Camera3D.new()
	camera.current = true
	arm.add_child(camera)

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		if Input.is_action_just_pressed("ui_accept"):
			velocity.y = JUMP_VELOCITY

	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := Vector3(input_dir.x, 0, input_dir.y).rotated(Vector3.UP, camera_pivot.rotation.y)
	if direction.length() > 0.05:
		velocity.x = direction.x * SPEED
		velocity.z = direction.z * SPEED
		rotation.y = lerp_angle(rotation.y, atan2(-direction.x, -direction.z), delta * 10.0)
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED * 5.0 * delta)
		velocity.z = move_toward(velocity.z, 0, SPEED * 5.0 * delta)
	move_and_slide()
