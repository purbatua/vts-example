<template>
  <div class="main">
    <div class="wrapper">
      <div class="speed">
        <p class="speed-label">Speed</p>
        <p class="speed-value">{{ currentSpeed || 0 }} <span>Km/h</span></p>
      </div>
      <div class="btn-group">
        <button @click="start">Start</button>
        <template v-if="!isPaused">
          <button @click="pause">Pause</button>
        </template>
        <template v-else>
          <button @click="resume">Resume</button>
        </template>
        <button @click="stop">Stop</button>
      </div>
      <div class="btn-group">
        <button class="btn-speed" :class="[ animationSpeed === 1 ? 'active': '' ]" @click="animationSpeed = 1">1x</button>
        <button class="btn-speed" :class="[ animationSpeed === 0.5 ? 'active': '' ]" @click="animationSpeed = 0.5">2x</button>
        <button class="btn-speed" :class="[ animationSpeed === 0.25 ? 'active': '' ]" @click="animationSpeed = 0.25">4x</button>
        <button class="btn-speed" :class="[ animationSpeed === 0.125 ? 'active': '' ]" @click="animationSpeed = 0.125">8x</button>
      </div>
      <div class="speed-chart">
        <LineChart :chartdata="chartdata" :options="chartoptions" />
      </div>
    </div>
    <GmapMap
      :center="center"
      :zoom="zoom"
      :options="{
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }"
      ref="gmapEl"
      map-type-id="roadmap"
      style="width: 100%; height: 100%; min-height: 100vh;"
    />
  </div>
</template>

<script>
import { gmapApi } from 'gmap-vue'
import LineChart from '@/components/chart/LineChart'
import transjakarta from '@/data/transjakarta.json'

export default {
  name: "HomePage",
  components: {
    LineChart,
  },
  data() {
    return {
      map: null, // map element
      zoom: 16,
      center: { lat: -6.180550, lng: 106.826209 },
      origin: {},
      vehicle: {}, // vehicle marker object
      segments: [], // array of road segments
      currentSpeed: 0,
      rafId: null, // request animation frame id
      timeoutId: null,
      isPaused: false,
      isStopped: false,
      animationSpeed: 0.125,
      colors: [
        '#ff0000',
        '#0000ff',
        '#3cb371',
        '#ee82ee',
        '#ffa500',
        '#6a5acd',
      ],
      limit: 100,
      chartoptions: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          xAxes: [{
            ticks: {
              suggestedMin: 10,
              suggestedMax: 20
            },
            type: 'time',
            distribution: 'series',
            time: {
              unit: 'minute',
              tooltipFormat: 'DD MMMM YYYY HH:mm:ss',
              displayFormats: {
                minute: 'HH:mm'
              },
            }
          }]
        }
      }
    }
  },
  async mounted() {
    //- Wait for google map api fully loaded
    await this.$gmapApiPromiseLazy()

    this.$refs.gmapEl.$mapPromise.then((map) => {
      this.map = map
    })
  },
  computed: {
    google: gmapApi,
    chartdata() {
      const pos = [...transjakarta].slice(0, this.limit)
      const len = pos.length

      const data = {
        labels: [],
        datasets: [
          {
            label: 'Speed',
            backgroundColor: 'rgba(60, 179, 113, 0.8)',
            data: []
          }
        ]
      }
      
      for (let i = 0; i < len; i++) {
        const curr = pos[i]
        data.labels.push(new Date(curr.timestamp))
        data.datasets[0].data.push(curr.speed)
      }

      return data
    }
  },
  methods: {
    async initVehicle() {
      if (!transjakarta) {
        return
      }

      const pos = [...transjakarta].slice(0, this.limit)
      const len = pos.length

      //- Shorten function
      const mapFn = this.google.maps
      const spherical = mapFn.geometry.spherical
      const gLatLng = (...args) => new mapFn.LatLng(...args)
      const calcDistance = (...args) => spherical.computeDistanceBetween(...args)
      const getTime = t => new Date(t).getTime()
      const timeDiff = (tstart, tend) => Math.abs(getTime(tstart) - getTime(tend))
      const paths = pos.map((p) => gLatLng(p.latitude, p.longitude))

      try {
        const temp = await this.snapToRoad(paths)

        for (let i = 0; i < temp.length; i++) {
          const curr = temp[i]
          const currLoc = gLatLng(curr.location.latitude, curr.location.longitude)

          if (Number.isInteger(curr.originalIndex)) {
            pos[curr.originalIndex].location = currLoc
          }
        }
      } catch(e) {
        throw new Error(e)
      }

      console.log('GPS data points total', len)

      //- Set origin and destionation object
      this.origin = pos[0].location.toJSON()

      //- Set the center of map
      this.center = this.origin

      //- Build road segment array
      for (let i = 0; i < len; i++) {
        const curr = pos[i]
        const next = pos[i+1] || {}
  
        if (i < len-1) {
          const start = curr.location || gLatLng(curr.latitude, curr.longitude)
          const end = next.location || gLatLng(next.latitude, next.longitude)

          const distance_in_meter = calcDistance(start, end)
          const distance_in_km = distance_in_meter ? distance_in_meter/1000 : 0 // in Km
          const speed = curr.speed || 0
          const time = speed ? distance_in_km/speed : 0
          const time_in_second = (time * 60) * 60
          const timestamp_diff = timeDiff(next.timestamp, curr.timestamp)

          this.segments.push({
            // location: curr.location,
            location_path: [curr.location, next.location],
            start,
            end,
            speed,
            distance_in_km,
            distance_in_meter,
            time,
            time_in_second,
            timestamp_diff,
            course: curr.course,
          })

          this.drawRoadSegment(start, end, 2)
        } else {
          break
        }
      }

      //- Initialize position of vehicle
      this.vehicle = new this.google.maps.Marker({
        position: this.segments[0].start,
        map: this.map,
        zIndex: 10,
        icon: {
          path: 'M29.395,0H17.636c-3.117,0-5.643,3.467-5.643,6.584v34.804c0,3.116,2.526,5.644,5.643,5.644h11.759   c3.116,0,5.644-2.527,5.644-5.644V6.584C35.037,3.467,32.511,0,29.395,0z M34.05,14.188v11.665l-2.729,0.351v-4.806L34.05,14.188z    M32.618,10.773c-1.016,3.9-2.219,8.51-2.219,8.51H16.631l-2.222-8.51C14.41,10.773,23.293,7.755,32.618,10.773z M15.741,21.713   v4.492l-2.73-0.349V14.502L15.741,21.713z M13.011,37.938V27.579l2.73,0.343v8.196L13.011,37.938z M14.568,40.882l2.218-3.336   h13.771l2.219,3.336H14.568z M31.321,35.805v-7.872l2.729-0.355v10.048L31.321,35.805',
          scale: 0.6,
          fillColor: "#427af4",
          fillOpacity: 1,
          strokeWeight: 1,
          anchor: new this.google.maps.Point(22, 22),
          rotation: pos[0].course || 0,
        },
      })
    },
    async start() {
      this.isPaused = false
      this.isStopped = false

      if (this.segments.length === 0) {
        await this.initVehicle()
      }

      let index = 0
      for (const segment of this.segments) {
        const duration = segment.time_in_second * 1000
        const timingFn =  (timeFraction) => (timeFraction) // timing linear
        const drawFn = (progress) => {
          this.moveVehicle(segment, progress)
        }

        if (index % 25 === 0) {
          //- Set the center of map
          this.center = segment.end.toJSON()
        }

         //- Set current speed
        this.currentSpeed = segment.speed

        await this.animation(duration, timingFn, drawFn)

        index++
      }

      this.stop()
    },
    pause() {
      if (!this.isPaused) {
        this.isPaused = true
      }
    },
    async resume() {
      if (this.isPaused) {
        this.isPaused = false
      }
    },
    async stop() {
      this.isPaused = false
      this.isStopped = true

      this.stopAnimation()

      // rollback to initial state
      if (this.segments.length === 0) {
        await this.initVehicle()
      }
    },
    moveVehicle(segment, progress) {
      if (!segment || progress === 1) {
        return
      }

      const LatLng = (...args) => new this.google.maps.LatLng(...args)
      const computeHeading = this.google.maps.geometry.spherical.computeHeading
      const computeOffset = this.google.maps.geometry.spherical.computeOffset

      //- Destructure road segment object
      const { start, end, distance_in_meter } = segment // course

      //- Calculate distance delta
      const distance = distance_in_meter * progress

      const heading = computeHeading(start, end)
      const newPosition = computeOffset(start, distance, heading)

      const position = newPosition.toJSON()
      const posLatLng = LatLng(position.lat, position.lng)

      //- Set vehicle position and heading
      const icon = this.vehicle.getIcon()
      icon.rotation = heading
      this.vehicle.setIcon(icon)
      this.vehicle.setPosition(posLatLng)
    },
    drawRoadSegment(start, end, colorIndex = 0) {
      //- Draw each road segment 
      new this.google.maps.Polyline({
        path: [start, end],
        map: this.map,
        geodesic: true,
        strokeColor: this.colors[colorIndex],
        strokeWeight: 12,
        strokeOpacity: 1.0,
      })
    },
    async snapToRoad(paths, interpolate = false) { // max: 100 data
      paths = paths.map((path) => {
        return path.toUrlValue()
      })

      const qs = new URLSearchParams({
        interpolate: interpolate,
        key: process.env.VUE_APP_GMAP_API_KEY,
        path: paths.join('|')
      })

      const response = await fetch(`https://roads.googleapis.com/v1/snapToRoads?${qs}`)

      if (response.ok) {
        const data = await response.json()
        return (data || {}).snappedPoints || []
      } else {
        throw new Error(response)
      }
    },
    animation(duration, timingFn, drawFn) {
      return new Promise((resolve) => {
        
        //- Define request animation frame with its fallback
        const raf = (function() {
          return requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            function(callback) {
              window.setTimeout(callback, 1000 / 60)
            }
        })()

        const start = performance.now()
        let delay = 0

        function animate(time) {
          const now = performance.now()

          if (this.isPaused) {
            this.timeoutId = setTimeout(() => {
              delay = now - time
              animate.bind(this)(time)
            }, 0)
          } else {
            //- timeFraction goes from 0 (start) to 1 (end)
            // TODO fix this
            let timeFraction = ((time - delay) - start) / (duration * this.animationSpeed)

            if (this.timeoutId) {
              clearTimeout(this.timeoutId)
              delay = 0
            }

            if (timeFraction > 1) {
              timeFraction = 1
            }
        
            //- Calculate the current animation progress 0 (start) to 1 (end)
            let progress = timingFn(timeFraction)
        
            //- Call draw function
            drawFn(progress)

            if (this.isStopped) {
              return this.stopAnimation()
            }
        
            if (progress === 1) {
              this.stopAnimation()
              return resolve(1)
            }

            if (timeFraction < 1) {
              raf(animate.bind(this))
            }
          }
        }

        //- Call animate
        this.rafId = raf(animate.bind(this))
      })
    },
    stopAnimation() {
      const cancelAnimationFrame = window.cancelAnimationFrame || function(id) { clearTimeout(id) }

      return cancelAnimationFrame(this.rafId)
    },
  }
};
</script>

<style scoped>
.main {
  position: relative;
  height: 100%;
  max-height: 100vh;
}

.wrapper {
  position: absolute;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 20%;
  background: rgba(255, 255, 255, 0.8);
  padding: 30px;
}

.speed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.speed-label {
  font-size: 1rem;
  font-weight: 800;
}

.speed-value {
  font-size: 1.5rem;
  font-weight: 800;
}

.btn-group {
  margin: 15px auto;
}

.btn-speed {
  font-size: 1.25rem;
  font-weight: 800;
  padding: 0.5rem;
  border: 1px solid #93f0bd;
  cursor: pointer;
}

.btn-speed:focus {
  outline: none;
}

.btn-speed.active {
  background-color: #3cb371;
  color: #fff;
}
</style>