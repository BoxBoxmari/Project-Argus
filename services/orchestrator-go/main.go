package main
import ( "bufio"; "os"; "encoding/json"; "log" )
type Item struct { URL string `json:"url"`; }
func main(){
  f, err := os.Open("datasets/queue.ndjson"); if err!=nil { log.Fatal(err) }
  sc := bufio.NewScanner(f)
  for sc.Scan() {
    var m map[string]any
    if err := json.Unmarshal(sc.Bytes(), &m); err==nil {
      // do schedule / metrics export here
    }
  }
}
