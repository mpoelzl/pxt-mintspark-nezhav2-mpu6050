//% weight=100 color=#DC22E1 block="MINTspark NeZha V2" blockId="MINTspark NeZha V2" icon="\uf0e7"
namespace ms_nezhaV2 {
    /*
     * NeZha V2
     */
    let MPU6050Initialised = false;

    //% weight=30
    //% block="Gyro drive %direction speed %speed"
    //% subcategory="Robot Tank Drive"
    //% group="Gyro Movement"
    //% speed.min=1 speed.max=100
    //% color=#6e31c4
    //% inlineInputMode=inline
    export function driveTankModeSingleSpeedGyro(direction: LinearDirection, speed: number): void {
        speed = Math.abs(speed);
        speed = (direction == LinearDirection.Forward) ? speed : -speed;

        // Setup IMU, exit if not initialised
        if (!setupAndCalibrateMPU6050()) {
            return;
        }

        // Drive with PID Control
        control.inBackground(() => {
            driveTankModeSingelSpeedGyroPid(speed, 60000, MotorMovementMode.Seconds);
        })
    }

    //% weight=25
    //% block="Gyro drive %direction speed %speed for %value %mode"
    //% subcategory="Robot Tank Drive"
    //% group="Gyro Movement"
    //% speed.min=1 speed.max=100
    //% expandableArgumentMode="toggle"
    //% color=#6e31c4
    //% inlineInputMode=inline
    export function driveTankModeSingleSpeedGyroFor(direction: LinearDirection, speed: number, value: number, mode: MotorMovementMode): void {
        speed = Math.abs(speed);
        speed = (direction == LinearDirection.Forward) ? speed : -speed;

        // Setup IMU, exit if not initialised
        if (!setupAndCalibrateMPU6050()) {
            return;
        }

        let target = 0;
        let getCurrentValue: () => number;
        let startTime = input.runningTime();
        let startDegrees = readServoAbsolutePostionContinuous(tankMotorLeft)

        switch (mode) {
            case MotorMovementMode.Seconds:
                target = value * 1000;
                getCurrentValue = () => input.runningTime() - startTime;
                break;
            case MotorMovementMode.Degrees:
                target = value;
                getCurrentValue = () => Math.abs(readServoAbsolutePostionContinuous(tankMotorLeft) - startDegrees);
                break;
            case MotorMovementMode.Turns:
                target = value * 360;
                getCurrentValue = () => Math.abs(readServoAbsolutePostionContinuous(tankMotorLeft) - startDegrees);
                break;
        }

        // Drive with PID Control
        driveTankModeSingelSpeedGyroPidToTarget(speed, target, getCurrentValue);
    }


    //% weight=24
    //% block="Gyro drive %direction speed %speed for %distance %distanceUnit"
    //% subcategory="Robot Tank Drive"
    //% group="Gyro Movement"
    //% speed.min=1 speed.max=100
    //% expandableArgumentMode="toggle"
    //% color=#6e31c4
    //% inlineInputMode=inline
    export function driveTankModeSingleSpeedGyroForDistance(direction: LinearDirection, speed: number, distance: number, distanceUnit: DistanceUnint): void {
        speed = Math.abs(speed);
        speed = (direction == LinearDirection.Forward) ? speed : -speed;

        // Setup IMU, exit if not initialised
        if (!setupAndCalibrateMPU6050()) {
            return;
        }

        // Calculate required degrees for distance
        let distMm = (distanceUnit == DistanceUnint.Cm) ? distance * 10 : distance * 10 * 2.54;
        let target = distMm * wheelLinearDegreePerMm;
        let startDegrees = readServoAbsolutePostionContinuous(tankMotorLeft)
        let getCurrentValue = () => Math.abs(readServoAbsolutePostionContinuous(tankMotorLeft) - startDegrees);

        // Drive with PID Control
        driveTankModeSingelSpeedGyroPidToTarget(speed, target, getCurrentValue);
    }

    function setupAndCalibrateMPU6050() : boolean{
        // Setup IMU
        if (!MPU6050Initialised) {
            MPU6050Initialised = MINTsparkMpu6050.InitMPU6050(0);
        }

        // Calibrate
        if (MPU6050Initialised)
        {
            // Calibrate 6050 sensor for 1 second (robot must remain still during this period)
            MINTsparkMpu6050.Calibrate(1);
            return true;
        }

        return false;
    }

    function driveTankModeSingelSpeedGyroPid(speed: number, value: number, mode: MotorMovementMode):void{
        if (speed == 0) return;
        newMotorMovement = false;
        let target = 0;
        let currentValue = 0;

        switch(mode)
        {
            case MotorMovementMode.Seconds:
                target = value * 1000;
                break;
            case MotorMovementMode.Degrees:
                target = value;
                break;
            case MotorMovementMode.Turns:
                target = value * 360;
                break;
        }

        let startTime = input.runningTime();
        let lastUpdateTime = startTime;
        let Kp = 10; let Ki = 0.05; let Kd = 0.5;

        let pidController = new MINTsparkMpu6050.PIDController();
        pidController.setGains(Kp, Ki, Kd);
        pidController.setPoint(MINTsparkMpu6050.UpdateMPU6050().orientation.yaw);
        let speedL = speed;
        let speedR = speed;

        // Start movement
        driveTankDualSpeed(speedL / 2, speedR / 2);

        while (input.runningTime() - startTime < target) {
            if (newMotorMovement) break;

            let updateTime = input.runningTime();
            let pidCorrection = pidController.compute(updateTime - lastUpdateTime, MINTsparkMpu6050.UpdateMPU6050().orientation.yaw);
            lastUpdateTime = updateTime;

            speedL = Math.constrain(speed + pidCorrection, 0, 100);
            speedR = Math.constrain(speed - pidCorrection, 0, 100);

            // Change motor speed
            if (newMotorMovement) break;
            driveTankDualSpeed(speedL, speedR);

            basic.pause(10);

            if (mode == MotorMovementMode.Seconds)
            {
                currentValue = input.runningTime() - startTime;
            }
            else
            {
                
            }
        }

        stopTank();
    }

    function driveTankModeSingelSpeedGyroPidToTarget(speed: number, target: number, getCurrentValue: () => number): void {
        if (speed == 0) return;
        newMotorMovement = false;

        let lastUpdateTime = input.runningTime();
        let Kp = 10; let Ki = 0.05; let Kd = 0.5;

        let pidController = new MINTsparkMpu6050.PIDController();
        pidController.setGains(Kp, Ki, Kd);
        pidController.setPoint(MINTsparkMpu6050.UpdateMPU6050().orientation.yaw);
        let speedL = speed;
        let speedR = speed;

        // Start movement
        driveTankDualSpeed(speedL / 2, speedR / 2);

        while (getCurrentValue() < target) {
            if (newMotorMovement) break;

            let updateTime = input.runningTime();
            let pidCorrection = pidController.compute(updateTime - lastUpdateTime, MINTsparkMpu6050.UpdateMPU6050().orientation.yaw);
            lastUpdateTime = updateTime;

            speedL = Math.constrain(speed + pidCorrection, 0, 100);
            speedR = Math.constrain(speed - pidCorrection, 0, 100);

            // Change motor speed
            if (newMotorMovement) break;
            driveTankDualSpeed(speedL, speedR);

            basic.pause(10);
        }

        stopTank();
    }

    //% subcategory="Robot Tank Drive"
    //% group="Gyro Movement"
    //% block="Gyro spot-turn %turn for angle %angle || with speed %speed"
    //% expandableArgumentMode="toggle"
    //% inlineInputMode=inline
    //% speed.min=10 speed.max=100 speed.defl=25 angle.min=1 angle.max=200 angle.defl=90
    //% weight=20
    //% color=#6e31c4
    export function turnTankModeGyro(turn: TurnDirection, angle: number, speed?: number): void {
        newMotorMovement = true;

        if (speed == null) {
            speed = 15;
        }

        let tmLSpeed = speed;
        let tmRSpeed = speed;
        if (turn == TurnDirection.Right) { tmRSpeed = -tmRSpeed; } else { tmLSpeed = -tmLSpeed; }

        // Setup IMU, exit if not initialised
        if (!setupAndCalibrateMPU6050()) {
            return;
        }

        MINTsparkMpu6050.Calibrate(1);

        let startTime = input.runningTime();
        let startHeading = MINTsparkMpu6050.UpdateMPU6050().orientation.yaw360;
        let previousHeading = startHeading;
        let totalChange = 0;

        driveTankDualSpeed(tmLSpeed, tmRSpeed);
        basic.pause(200);

        while (input.runningTime() - startTime < 5000) {
            let heading = MINTsparkMpu6050.UpdateMPU6050().orientation.yaw360;
            let change = previousHeading - heading;

            if (turn == TurnDirection.Right) {
                change *= -1;
            }

            if (change < 0) {
                change += 360;
            }

            totalChange += change;

            if (totalChange > angle) break;

            previousHeading = heading;
            basic.pause(10);
        }

        stopTank();
    }
}