import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { RiVolumeDownFill, RiVolumeUpFill } from 'react-icons/ri';

import './ElasticSlider.css';

const MAX_OVERFLOW = 50;

export default function ElasticSlider({
  value,
  defaultValue = 50,
  startingValue = 0,
  maxValue = 100,
  className = '',
  isStepped = false,
  stepSize = 1,
  leftIcon = <RiVolumeDownFill />,
  rightIcon = <RiVolumeUpFill />,
  showValue = true,
  valueFormatter = currentValue => Math.round(currentValue),
  ariaLabel = 'Slider',
  onChange
}) {
  return (
    <div className={`slider-container ${className}`}>
      <Slider
        value={value}
        defaultValue={defaultValue}
        startingValue={startingValue}
        maxValue={maxValue}
        isStepped={isStepped}
        stepSize={stepSize}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        showValue={showValue}
        valueFormatter={valueFormatter}
        ariaLabel={ariaLabel}
        onChange={onChange}
      />
    </div>
  );
}

function Slider({ value: controlledValue, defaultValue, startingValue, maxValue, isStepped, stepSize, leftIcon, rightIcon, showValue, valueFormatter, ariaLabel, onChange }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const sliderRef = useRef(null);
  const [region, setRegion] = useState('middle');
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);

  const updateValue = nextValue => {
    if (controlledValue === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  useMotionValueEvent(clientX, 'change', latest => {
    if (sliderRef.current) {
      const { left, right } = sliderRef.current.getBoundingClientRect();
      let newValue;

      if (latest < left) {
        setRegion('left');
        newValue = left - latest;
      } else if (latest > right) {
        setRegion('right');
        newValue = latest - right;
      } else {
        setRegion('middle');
        newValue = 0;
      }

      overflow.jump(decay(newValue, MAX_OVERFLOW));
    }
  });

  const handlePointerMove = e => {
    if (e.buttons > 0 && sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      let newValue = startingValue + ((e.clientX - left) / width) * (maxValue - startingValue);

      if (isStepped) {
        newValue = Math.round(newValue / stepSize) * stepSize;
      }

      newValue = Math.min(Math.max(newValue, startingValue), maxValue);
      updateValue(newValue);
      clientX.jump(e.clientX);
    }
  };

  const handlePointerDown = e => {
    handlePointerMove(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = () => {
    animate(overflow, 0, { type: 'spring', bounce: 0.5 });
  };

  const handleKeyDown = event => {
    let newValue = value;
    const keyboardStep = isStepped ? stepSize : (maxValue - startingValue) / 100;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') newValue -= keyboardStep;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') newValue += keyboardStep;
    else if (event.key === 'Home') newValue = startingValue;
    else if (event.key === 'End') newValue = maxValue;
    else return;

    event.preventDefault();
    updateValue(Math.min(Math.max(newValue, startingValue), maxValue));
  };

  const getRangePercentage = () => {
    const totalRange = maxValue - startingValue;
    if (totalRange === 0) return 0;

    return ((value - startingValue) / totalRange) * 100;
  };

  return (
    <>
      <motion.div
        onHoverStart={() => animate(scale, 1.2)}
        onHoverEnd={() => animate(scale, 1)}
        onTouchStart={() => animate(scale, 1.2)}
        onTouchEnd={() => animate(scale, 1)}
        style={{
          scale,
          opacity: useTransform(scale, [1, 1.2], [0.7, 1])
        }}
        className="slider-wrapper"
      >
        {leftIcon !== null && <motion.div
          animate={{
            scale: region === 'left' ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 }
          }}
          style={{
            x: useTransform(() => (region === 'left' ? -overflow.get() / scale.get() : 0))
          }}
        >
          {leftIcon}
        </motion.div>}

        <div
          ref={sliderRef}
          className="slider-root"
          role="slider"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-valuemin={startingValue}
          aria-valuemax={maxValue}
          aria-valuenow={value}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            style={{
              scaleX: useTransform(() => {
                if (sliderRef.current) {
                  const { width } = sliderRef.current.getBoundingClientRect();
                  return 1 + overflow.get() / width;
                }
              }),
              scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
              transformOrigin: useTransform(() => {
                if (sliderRef.current) {
                  const { left, width } = sliderRef.current.getBoundingClientRect();
                  return clientX.get() < left + width / 2 ? 'right' : 'left';
                }
              }),
              height: useTransform(scale, [1, 1.2], [6, 12]),
              marginTop: useTransform(scale, [1, 1.2], [0, -3]),
              marginBottom: useTransform(scale, [1, 1.2], [0, -3])
            }}
            className="slider-track-wrapper"
          >
            <div className="slider-track">
              <div className="slider-range" style={{ width: `${getRangePercentage()}%` }} />
            </div>
          </motion.div>
        </div>

        {rightIcon !== null && <motion.div
          animate={{
            scale: region === 'right' ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 }
          }}
          style={{
            x: useTransform(() => (region === 'right' ? overflow.get() / scale.get() : 0))
          }}
        >
          {rightIcon}
        </motion.div>}
      </motion.div>
      {showValue && <p className="value-indicator">{valueFormatter(value)}</p>}
    </>
  );
}

function decay(value, max) {
  if (max === 0) {
    return 0;
  }

  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);

  return sigmoid * max;
}
